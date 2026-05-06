import { serverClient } from '../supabase-server'
import { getAnthropic } from '../anthropic'
import { generateImage } from '../gemini'

// Creatives to generate per niche per daily batch
const NICHE_COUNTS: Record<string, number> = { bouw: 3, dakkapel: 3, daken: 2 }
const NICHES = ['bouw', 'dakkapel', 'daken'] as const

interface WinnerRow {
  id:           string
  niche:        string
  image_url:    string
  overlay_text: string | null
  notes:        string | null
  cpl:          number | null
  leads:        number | null
  ctr:          number | null
  spend:        number | null
}

interface RejectionRow {
  rejection_reason: string
  rejection_notes:  string | null
}

interface Concept {
  prompt:            string
  copy_headline:     string
  copy_body:         string
  copy_cta:          string
  angle_description: string
}

// ── Claude system prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Je bent de marketing creative director van Bouw Check, een performance-based lead gen agency in de Nederlandse bouw. Je taak: dagelijks nieuwe ad concepts genereren voor Meta ads, gebaseerd op bewezen winners.

WERKWIJZE:
1. Analyseer de winners. Vraag jezelf: wat is de WINNING TRIGGER? Het is meestal niet de visuele stijl, maar de psychologische trigger:
   - Price anchor (vanaf €X)
   - Speed/urgency (binnen 1 dag, binnen 5 uur)
   - Seasonal action (lente actie)
   - Concrete value (€30k meer waard)
2. Pas die trigger toe op NIEUWE visuele hoeken. Niet de winner herkauwen, maar de trigger in andere settings stoppen.
3. Tekst overlays: ALTIJD trigger-based. Geen 'vakmanschap', 'kwaliteit' of 'ervaring' — die woorden triggeren niemand.

REGELS:
- Output is een JSON array, exact dit format: [{"prompt":"...","copy_headline":"...","copy_body":"...","copy_cta":"...","angle_description":"..."}]
- prompt: complete Gemini-ready image prompt in English, includes scene + text overlay specs
- copy_headline: max 6 woorden, Dutch, de trigger zelf
- copy_body: 1 zin Dutch, ondersteunt de trigger
- copy_cta: 2-3 woorden Dutch (bijv. "Vraag offerte", "Bekijk opties", "Plan inspectie")
- angle_description: 1 zin Dutch, uitleg waarom dit visuele hoek de trigger versterkt
- Geen markdown, geen extra tekst — alleen raw JSON array

VISUAL STYLE VOOR PROMPTS:
- Photorealistic, Dutch context (rijtjeshuizen, NL straten, typisch Nederlandse woningen)
- 1:1 aspect ratio, Facebook/Instagram ad format
- Voeg text overlay specs toe in de prompt (positie, kleur, grootte)
- GEEN complete huizen met schuine daken als 'dakkapel' — dakkapel = klein dakkapelmodule met eigen zadeldak op een bestaand dak
- Mix van achtergronden: werf, woonhuis, before/after splits, vakmensen aan het werk, materialen
- Text overlays op donkere balk onderaan of bovenaan, wit op donker achtergrond`

// ── Rejection context: last 14 days ──────────────────────────────────────────

const REJECTION_LABEL: Record<string, string> = {
  boring:        'Saai / geen trigger',
  off_brand:     'Niet passend bij merk',
  wrong_text:    'Tekst overlay klopt niet',
  wrong_niche:   'Verkeerde niche / context',
  fluff:         'Te vaag / fluff copy',
  unrealistic:   'Onrealistisch beeld',
  wrong_overlay: 'Overlay slecht geplaatst',
  other:         'Anders',
}

async function getRejectionContext(niche: string): Promise<string | null> {
  const db      = serverClient()
  const cutoff  = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await db
    .from('creatives')
    .select('rejection_reason, rejection_notes')
    .eq('niche', niche)
    .eq('status', 'rejected')
    .not('rejection_reason', 'is', null)
    .gte('reviewed_at', cutoff)

  if (!data || data.length === 0) return null

  // Group by reason
  const counts: Record<string, number> = {}
  const notesByReason: Record<string, string[]> = {}

  for (const row of data as RejectionRow[]) {
    const r = row.rejection_reason
    counts[r] = (counts[r] ?? 0) + 1
    if (row.rejection_notes) {
      notesByReason[r] = notesByReason[r] ?? []
      notesByReason[r].push(row.rejection_notes)
    }
  }

  const lines = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => {
      const label = REJECTION_LABEL[reason] ?? reason
      const notes = notesByReason[reason]
      const noteStr = notes?.length ? ` — toelichting: "${notes.join('"; "')}"` : ''
      return `  - ${label} (${count}x)${noteStr}`
    })

  return `AFGEWEZEN IN AFGELOPEN 14 DAGEN (VERMIJD DEZE PATRONEN):
${lines.join('\n')}

Zorg dat je nieuwe concepts NIET in deze valkuilen vallen.`
}

// ── Claude call: get concepts for one niche ───────────────────────────────────

async function generateConcepts(
  niche: string,
  winners: WinnerRow[],
  count: number,
): Promise<Concept[]> {
  const winnerSummary = winners.map((w, i) => {
    const stats = [
      w.cpl  != null ? `€${w.cpl} CPL`   : null,
      w.leads != null ? `${w.leads} leads` : null,
      w.ctr  != null ? `${w.ctr}% CTR`   : null,
    ].filter(Boolean).join(', ')

    return `Winner ${i + 1}:
- Overlay tekst: ${w.overlay_text ?? '(geen)'}
- Performance: ${stats || '(geen stats)'}
- Notities: ${w.notes ?? '(geen)'}`
  }).join('\n\n')

  // Pass winner images as vision inputs so Claude can actually see them
  const imageBlocks = winners.map(w => ({
    type:   'image'  as const,
    source: { type: 'url' as const, url: w.image_url },
  }))

  const rejectionContext = await getRejectionContext(niche)

  const userText = `Genereer ${count} nieuwe ${niche} creatives voor vandaag.

WINNERS VOOR DEZE NICHE (zie afbeeldingen hierboven):
${winnerSummary}
${rejectionContext ? '\n' + rejectionContext + '\n' : ''}
Analyseer de winning triggers in de afbeeldingen en teksten, pas die triggers toe op ${count} NIEUWE visuele hoeken.
Geef je antwoord als raw JSON array — geen markdown, geen extra tekst.`

  const textBlock = { type: 'text' as const, text: userText }

  const message = await getAnthropic().messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2048,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: [...imageBlocks, textBlock] }],
  })

  const text = message.content.find(b => b.type === 'text')?.text ?? ''
  const json = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

  let concepts: Concept[]
  try {
    concepts = JSON.parse(json)
    if (!Array.isArray(concepts)) throw new Error('not an array')
  } catch {
    throw new Error(`Claude returned unexpected format: ${json.slice(0, 200)}`)
  }

  return concepts.slice(0, count)
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export interface BatchResult {
  batchId:    string
  creatives:  number
  errors:     Array<{ niche: string; step: string; error: string }>
}

export async function generateDailyBatch(): Promise<BatchResult> {
  const db      = serverClient()
  const today   = new Date().toISOString().slice(0, 10)
  const now     = new Date().toISOString()
  const errors: BatchResult['errors'] = []

  // 1. Create batch row
  const { data: batch, error: batchErr } = await db
    .from('creative_batches')
    .insert({
      run_date:        today,
      niches:          [...NICHES],
      total_creatives: 0,
      status:          'running',
      started_at:      now,
    })
    .select('id')
    .single()

  if (batchErr || !batch) throw new Error(`Could not create batch: ${batchErr?.message}`)
  const batchId = batch.id

  let totalCreatives = 0

  // 2. Per-niche loop
  for (const niche of NICHES) {
    const count = NICHE_COUNTS[niche]

    // 2a. Fetch winners
    const { data: winners } = await db
      .from('winners')
      .select('id, niche, image_url, overlay_text, notes, cpl, leads, ctr, spend')
      .eq('niche', niche)
      .eq('is_winner', true)
      .order('cpl', { ascending: true })

    if (!winners || winners.length === 0) {
      errors.push({ niche, step: 'fetch-winners', error: 'No winners for this niche — skipping' })
      continue
    }

    // 2b. Get concepts from Claude
    let concepts: Concept[]
    try {
      concepts = await generateConcepts(niche, winners as WinnerRow[], count)
    } catch (err: any) {
      errors.push({ niche, step: 'claude', error: err.message })
      continue
    }

    // 2c. Generate images + save rows
    const primaryWinnerId = (winners as WinnerRow[])[0].id

    for (const concept of concepts) {
      const creativeId = crypto.randomUUID()

      // Generate image
      let imageBuffer: Buffer
      try {
        imageBuffer = await generateImage(concept.prompt)
      } catch (err: any) {
        errors.push({ niche, step: 'gemini', error: `${err.message} — prompt: ${concept.prompt.slice(0, 80)}` })
        continue
      }

      // Upload to storage
      const storagePath = `${batchId}/${niche}/${creativeId}.png`
      const { error: uploadErr } = await db.storage
        .from('creative-output')
        .upload(storagePath, imageBuffer, { contentType: 'image/png', upsert: false })

      if (uploadErr) {
        errors.push({ niche, step: 'storage', error: uploadErr.message })
        continue
      }

      const { data: { publicUrl } } = db.storage
        .from('creative-output')
        .getPublicUrl(storagePath)

      // Insert creative row
      const { error: rowErr } = await db.from('creatives').insert({
        id:                creativeId,
        batch_id:          batchId,
        batch_date:        today,
        niche,
        prompt_used:       concept.prompt,
        copy_headline:     concept.copy_headline,
        copy_body:         concept.copy_body,
        copy_cta:          concept.copy_cta,
        angle_description: concept.angle_description,
        image_url:         publicUrl,
        status:            'pending',
        source_winner_id:  primaryWinnerId,
      })

      if (rowErr) {
        errors.push({ niche, step: 'db-insert', error: rowErr.message })
        continue
      }

      totalCreatives++
    }
  }

  // 3. Update batch
  const finalStatus = totalCreatives === 0 ? 'failed'
    : errors.length > 0 ? 'complete'
    : 'complete'

  await db.from('creative_batches').update({
    status:          finalStatus,
    completed_at:    new Date().toISOString(),
    total_creatives: totalCreatives,
    error_log:       errors.length > 0 ? JSON.stringify(errors, null, 2) : null,
  }).eq('id', batchId)

  return { batchId, creatives: totalCreatives, errors }
}
