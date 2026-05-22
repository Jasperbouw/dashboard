import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

// ── Constants ─────────────────────────────────────────────────────────────────

const INSPECTION_STATUSES = ['Inspectie gepland', 'Afspraak gepland']
const QUOTE_STATUSES      = ['Offerte verzonden', 'Offerte verstuurd', 'Laatste poging']
const ACTIVE_NICHES       = ['daken', 'dakkapel', 'bouw'] as const

type Niche = typeof ACTIVE_NICHES[number]

const NICHE_LABEL: Record<Niche, string> = {
  daken:    'Daken',
  dakkapel: 'Dakkapel',
  bouw:     'Bouw',
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  if (auth && process.env.CRON_SECRET) {
    if (auth.replace(/^Bearer\s+/i, '') === process.env.CRON_SECRET) return true
  }
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret && cronSecret === process.env.CRON_SECRET) return true
  const syncSecret = req.headers.get('x-sync-secret')
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true
  return false
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function weekWindow(): { from: string; to: string; label: string } {
  const now = new Date()
  // Sunday at cron time — week = last Monday 00:00 UTC to today 00:00 UTC
  const to   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)

  const fmt = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric', month: 'long',
  })
  const label = `${fmt.format(from)} – ${fmt.format(new Date(to.getTime() - 1))}`

  return { from: from.toISOString(), to: to.toISOString(), label }
}

function getAmsterdamHour(date: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Amsterdam',
      hour: 'numeric', hour12: false,
    }).format(date),
    10,
  )
}

// ── Data fetching ─────────────────────────────────────────────────────────────

interface NicheStats {
  leads:      number
  doorgezet:  number
  inspecties: number
  offertes:   number
}

type ChangeRow = {
  lead_id:   string
  to_status: string
  leads: { contractor_id: string | null; board_id: number | null } | null
}

async function fetchWeekStats(from: string, to: string): Promise<{
  totals:  NicheStats
  byNiche: Record<Niche, NicheStats>
}> {
  const db = serverClient()

  const [
    { data: leadsData },
    { data: boardConfigs },
    { data: contractorsData },
    { data: changesData },
  ] = await Promise.all([
    db.from('leads')
      .select('contractor_id, board_id, canonical_stage')
      .gte('monday_created_at', from)
      .lt('monday_created_at', to),
    db.from('boards_config').select('id, niche'),
    db.from('contractors').select('id, niche, active'),
    db.from('lead_status_changes')
      .select('lead_id, to_status, leads!inner(contractor_id, board_id)')
      .in('to_status', [...INSPECTION_STATUSES, ...QUOTE_STATUSES])
      .gte('changed_at', from)
      .lt('changed_at', to),
  ])

  // Build niche lookup maps
  const boardNiche      = new Map<number, string>(
    (boardConfigs ?? []).filter(b => b.niche).map(b => [b.id, b.niche!]),
  )
  const contractorNiche = new Map<string, string>(
    (contractorsData ?? []).filter(c => c.niche).map(c => [c.id, c.niche!]),
  )
  const activeContractors = new Set((contractorsData ?? []).filter(c => c.active).map(c => c.id))

  function resolveNiche(contractorId: string | null, boardId: number | null): Niche | null {
    const raw = contractorId
      ? (contractorNiche.get(contractorId) ?? null)
      : (boardId != null ? (boardNiche.get(boardId) ?? null) : null)
    return raw && (ACTIVE_NICHES as readonly string[]).includes(raw) ? (raw as Niche) : null
  }

  const empty = (): NicheStats => ({ leads: 0, doorgezet: 0, inspecties: 0, offertes: 0 })
  const byNiche = Object.fromEntries(ACTIVE_NICHES.map(n => [n, empty()])) as Record<Niche, NicheStats>
  const totals  = empty()

  // Leads pass
  for (const l of leadsData ?? []) {
    const niche = resolveNiche(l.contractor_id, l.board_id)
    if (!niche) continue
    if (l.contractor_id && !activeContractors.has(l.contractor_id)) continue

    byNiche[niche].leads++
    totals.leads++

    // Doorgezet = lead exists on a contractor board (contractor_id IS NOT NULL)
    if (l.contractor_id && l.canonical_stage !== 'lost') {
      byNiche[niche].doorgezet++
      totals.doorgezet++
    }
  }

  // Stage transitions pass — deduplicated per lead per stage bucket
  const inspSeen = new Set<string>()
  const offSeen  = new Set<string>()

  for (const c of (changesData ?? []) as unknown as ChangeRow[]) {
    if (!c.leads) continue
    const niche = resolveNiche(c.leads.contractor_id, c.leads.board_id)
    if (!niche) continue

    if (INSPECTION_STATUSES.includes(c.to_status) && !inspSeen.has(c.lead_id)) {
      inspSeen.add(c.lead_id)
      byNiche[niche].inspecties++
      totals.inspecties++
    } else if (QUOTE_STATUSES.includes(c.to_status) && !offSeen.has(c.lead_id)) {
      offSeen.add(c.lead_id)
      byNiche[niche].offertes++
      totals.offertes++
    }
  }

  return { totals, byNiche }
}

// ── Message formatting ────────────────────────────────────────────────────────

function buildMessage(
  label:   string,
  totals:  NicheStats,
  byNiche: Record<Niche, NicheStats>,
): string {
  const lines: string[] = [
    `📊 *Weekoverzicht ${label}*`,
    '',
    '*Totaal*',
    `• Leads ingekomen: ${totals.leads}`,
    `• Doorgezet naar aannemer: ${totals.doorgezet}`,
    `• Inspecties gepland: ${totals.inspecties}`,
    `• Offertes verstuurd: ${totals.offertes}`,
  ]

  for (const niche of ACTIVE_NICHES) {
    const s = byNiche[niche]
    if (!s || s.leads === 0) continue
    lines.push('')
    lines.push(`*${NICHE_LABEL[niche]}* (${s.leads} leads)`)
    lines.push(`Doorgezet: ${s.doorgezet} • Inspecties: ${s.inspecties} • Offertes: ${s.offertes}`)
  }

  return lines.join('\n')
}

// ── Wassenger ─────────────────────────────────────────────────────────────────

async function sendWhatsApp(message: string): Promise<void> {
  const apiKey   = process.env.WASSENGER_API_KEY
  const groupId  = process.env.WASSENGER_GROUP_ID
  const deviceId = process.env.WASSENGER_DEVICE_ID

  if (!apiKey || !groupId) throw new Error('Missing WASSENGER_API_KEY or WASSENGER_GROUP_ID')

  const body: Record<string, string> = { group: groupId, message }
  if (deviceId) body.device = deviceId

  const res = await fetch('https://api.wassenger.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Token: apiKey },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Wassenger error ${res.status}: ${text}`)
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now   = new Date()
  const force = new URL(req.url).searchParams.get('force') === 'true'
  const hour  = getAmsterdamHour(now)

  // Only execute at 11:xx Amsterdam time (bypass with ?force=true for testing)
  if (!force && hour !== 11) {
    return NextResponse.json({
      ok:      true,
      skipped: true,
      reason:  `Amsterdam hour is ${hour}, expected 11 — pass ?force=true to override`,
    })
  }

  try {
    const { from, to, label } = weekWindow()
    const { totals, byNiche } = await fetchWeekStats(from, to)
    const message = buildMessage(label, totals, byNiche)

    if (force && !process.env.WASSENGER_API_KEY) {
      // Test mode: return message preview without sending
      return NextResponse.json({ ok: true, preview: true, from, to, message, totals })
    }

    await sendWhatsApp(message)

    console.log('[weekly-recap] sent ok — leads:', totals.leads, 'from:', from, 'to:', to)
    return NextResponse.json({ ok: true, from, to, totals })
  } catch (err: any) {
    console.error('[weekly-recap] error:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export const GET  = handler
export const POST = handler
