import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/* ── Agent prompts ── */
const AGENTS: Record<string, (ctx: any) => string> = {
  finance: (ctx) => `Je bent een financieel adviseur voor Bouw Check, een B2B lead generatie bedrijf voor aannemers in Nederland.

Je analyseert de volgende bedrijfsdata (maand: ${ctx.month}):

BEDRIJVEN EN MAANDCIJFERS:
${JSON.stringify(ctx.companies, null, 2)}

TOTALEN DEZE MAAND:
- Eigen commissie: €${ctx.totalOwn}
- Gegenereerd voor klanten: €${ctx.totalClient}
- Eigen target: €${ctx.ownTarget}
- Client target: €${ctx.clientTarget}

Geef een concrete financiële analyse in het Nederlands. Structureer je antwoord met:
1. **Maandoverzicht** — hoe presteert de maand vs targets
2. **Sterkste klanten** — wie presteert goed en waarom
3. **Aandachtspunten** — wie loopt achter, wat is het risico
4. **Contract alerts** — wie is bijna vol en moet hernieuwd worden
5. **Groeikansen** — concrete aanbeveling voor omzetgroei
6. **Actiepunten** — max 5 concrete stappen voor komende 2 weken

Wees direct en specifiek. Gebruik bedrijfsnamen. Geen vage adviezen.`,

  meta: (ctx) => `Je bent een Meta Ads specialist voor Bouw Check

CAMPAGNEDATA (geïmporteerd):
${JSON.stringify(ctx.campaigns?.slice(0, 20), null, 2)}

TOTALEN:
- Totaal besteed: €${ctx.totalSpend}
- Totaal leads: ${ctx.totalLeads}
- Blended CPL: €${ctx.blendedCPL}

Analyseer de campagnes en geef een audit rapport in het Nederlands:
1. **Performance samenvatting** — wat valt direct op
2. **Top performers** — welke campagnes schalen we direct
3. **Underperformers** — welke pauzeren/fixen we en waarom
4. **Budget advies** — concreet: van X naar Y budget voor welke campagne
5. **Creative aanbevelingen** — wat testen we als volgende
6. **Deze week doen** — max 5 prioritaire acties

Gebruik campagnenames. Geef concrete euro bedragen en percentages.`,

  branch: (ctx) => `Je bent een business development adviseur voor Bouw Check

HUIDIGE SITUATIE:
- Actieve divisies: ${ctx.divisions?.join(', ')}
- Actieve klanten: ${ctx.companies?.map((c: any) => `${c.name} (${c.division})`).join(', ')}
- Totale commissie / maand: €${ctx.totalOwn}

CONTEXT: Bouw Check genereert B2C leads via Meta Ads voor aannemers. Ze rekenen commissie per batch leads. Huidige branches: daken, dakkapel, bouw, extra's.

Analyseer en adviseer over branche-expansie:
1. **Marktanalyse** — welke aangrenzende branches zijn logisch en waarom
2. **Top 3 aanbevelingen** — concreet met argumentatie (doelgroepoverlap, seizoen, CPL verwachting)
3. **Snelste ROI** — welke branch kun je morgen starten met bestaand systeem
4. **Risico's** — wat zijn de valkuilen per aanbeveling
5. **Stappenplan** — hoe start je de eerste nieuwe branch in 30 dagen

Wees concreet over de Nederlandse verbouwmarkt.`,

  prospect: (ctx) => `Je bent een prospect research agent voor Bouw Check

ZOEKOPDRACHT:
- Branche: ${ctx.branche}
- Regio: ${ctx.regio}
- Extra context: ${ctx.context || 'geen'}

HUIDIGE KLANTEN (niet opnieuw benaderen):
${ctx.existingClients?.join(', ')}

Genereer een prospect analyse en aanpak voor het werven van nieuwe aannemers als klant:
1. **Ideaal klantprofiel** — kenmerken van de perfecte prospect in deze branche/regio
2. **Waar vind je ze** — concrete bronnen (brancheverenigingen, KvK sectoren, platforms)
3. **10 prospect criteria** — hoe herken je een goede vs slechte fit
4. **Aanpak script** — eerste contact per telefoon/LinkedIn (wat zeg je letterlijk)
5. **Bezwaren & antwoorden** — top 3 bezwaren en hoe je ze parkeert
6. **Verwachte pipeline** — realistisch hoeveel prospects → klanten in 30 dagen

Focus op de Nederlandse markt.`,

  ads_spy: (ctx) => `Je bent een competitive intelligence agent voor Bouw Check

ONDERZOEKSVRAAG:
- Branche: ${ctx.branche}
- Wat wil je weten: ${ctx.vraag}

Baseer je op je kennis van de Nederlandse advertentiemarkt voor aannemers/verbouwing:
1. **Wat werkt in deze branche** — bewezen hooks, angles en formats voor Meta Ads
2. **Seizoenspatronen** — wanneer adverteer je wanneer in deze branche
3. **CPL benchmarks** — realistische CPL verwachting voor Nederland
4. **Succesvolle ad angles** — top 5 hooks met uitleg waarom ze werken
5. **Wat vermijd je** — valkuilen en verboden claims in deze sector
6. **Creatief advies** — concrete ad teksten/concepten die je morgen kunt testen

Geef specifieke tekst voorbeelden voor headlines en primary text.`,

  weekly: (ctx) => `Je bent de wekelijkse business intelligence agent van Bouw Check

DATUM: ${new Date().toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

FINANCE (huidige maand: ${ctx.month}):
- Eigen commissie: €${ctx.totalOwn} / target €${ctx.ownTarget}
- Gegenereerd voor klanten: €${ctx.totalClient}
- Actieve klanten: ${ctx.companyCount}
- Bijna vol contract: ${ctx.nearFull?.join(', ') || 'geen'}

META ADS (laatste import):
- Besteed: €${ctx.metaSpend || '—'}
- Leads: ${ctx.metaLeads || '—'}
- Blended CPL: €${ctx.metaCPL || '—'}

BEDRIJVEN:
${ctx.companies?.map((c: any) => `- ${c.name}: commissie €${c.fee}, target €${c.target}`).join('\n')}

Genereer de wekelijkse business digest:
# 📊 Weekly Digest — Bouw Check

1. **Deze week in cijfers** — wat zijn de highlights
2. **Financieel signaal** — goed nieuws en zorgen
3. **Meta performance** — hoe lopen de campagnes
4. **Prioriteit #1 deze week** — het belangrijkste wat je moet doen
5. **Kansen** — wat ligt er klaar om op te pakken
6. **Reminder** — contracten, follow-ups, acties die niet vergeten mogen worden

Schrijf alsof je een slimme business partner bent die maandagochtend een briefing geeft. Direct, no-nonsense.`,
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'no_key' })
  }

  const { agentType, context } = await req.json()
  const promptFn = AGENTS[agentType]
  if (!promptFn) return Response.json({ error: 'unknown_agent' })

  const prompt = promptFn(context)

  // Streaming response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        })
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (err: any) {
        controller.enqueue(encoder.encode(`\n\nFout: ${err.message}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  })
}
