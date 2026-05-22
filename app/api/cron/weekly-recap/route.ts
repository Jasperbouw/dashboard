import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

// ── Constants ─────────────────────────────────────────────────────────────────

const INSPECTION_STATUSES       = ['Inspectie gepland', 'Afspraak gepland']
const QUOTE_STATUSES            = ['Offerte verzonden', 'Offerte verstuurd', 'Laatste poging']
// Dakkapel routing is group-based within DCN DK board — these group titles signal doorgezet
const DAKKAPEL_ROUTING_STATUSES = ['Doorgestuurd', 'Duurt', 'Christiaan']

// "bouw" bundles all construction-related work:
//   aanbouw / renovatie / verbouw (Hollands Prefab, Vastgoed Groep, T-Bouw, Flair,
//   Prefab Op Maat, Bouwcombinatie Amsterdam, Prefab Gelderland)
//   + nieuwbouw (Prefab Nieuwbouw) + zwembad (Prefab Zwembaden)
// All nine contractors carry niche='bouw' in the contractors table.
const ACTIVE_NICHES             = ['daken', 'dakkapel', 'bouw'] as const

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

// Returns the UTC timestamp of midnight Amsterdam for the given Amsterdam calendar date.
// Uses the offset at noon UTC (stable across DST transitions that happen near midnight).
function amsterdamMidnightMs(year: number, month: number, day: number): number {
  const noonUTC = Date.UTC(year, month, day, 12)
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date(noonUTC))
  const h         = Number(p.find(x => x.type === 'hour')!.value) % 24
  const m         = Number(p.find(x => x.type === 'minute')!.value)
  const s         = Number(p.find(x => x.type === 'second')!.value)
  const offsetMs  = (h * 3600 + m * 60 + s - 43200) * 1000  // delta vs noon UTC
  return Date.UTC(year, month, day) - offsetMs
}

// weekOffset=0 → current week (Monday 00:00 AMS → now)
// weekOffset=1 → previous week (same shape, shifted back 7 days)
function weekWindow(weekOffset = 0): { from: string; to: string; label: string } {
  const now = new Date()

  // Shift reference point back by weekOffset weeks
  const refNow = new Date(now.getTime() - weekOffset * 7 * 24 * 60 * 60 * 1000)

  // Amsterdam date + weekday at the reference time
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(refNow)
  const year    = Number(p.find(x => x.type === 'year')!.value)
  const month   = Number(p.find(x => x.type === 'month')!.value) - 1
  const day     = Number(p.find(x => x.type === 'day')!.value)
  const weekday = p.find(x => x.type === 'weekday')!.value

  // Days since Monday: Mon=0, Tue=1, …, Sun=6
  const DOW          = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dow          = DOW.indexOf(weekday)
  const daysSinceMon = (dow + 6) % 7

  // from = Monday 00:00 AMS of the reference week
  const from = new Date(amsterdamMidnightMs(year, month, day - daysSinceMon))
  // to   = reference moment (now, or now shifted back weekOffset weeks)
  const to   = refNow

  const fmt = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long',
  })
  const label = `${fmt.format(from)} – ${fmt.format(to)}`

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
      .in('to_status', [...INSPECTION_STATUSES, ...QUOTE_STATUSES, ...DAKKAPEL_ROUTING_STATUSES])
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

  // ── Leads pass — counts + doorgezet for Daken/Bouw ───────────────────────
  // Dakkapel doorgezet is event-based (group transitions), handled in the
  // changes pass below. Daken/Bouw doorgezet = created on contractor board
  // and not lost (board-move happens at creation for those niches).
  for (const l of leadsData ?? []) {
    const niche = resolveNiche(l.contractor_id, l.board_id)
    if (!niche) continue
    if (l.contractor_id && !activeContractors.has(l.contractor_id)) continue

    byNiche[niche].leads++
    totals.leads++

    if (niche !== 'dakkapel' && l.contractor_id && l.canonical_stage !== 'lost') {
      byNiche[niche].doorgezet++
      totals.doorgezet++
    }
  }

  // ── Changes pass — inspecties, offertes, + Dakkapel doorgezet ────────────
  // All sets deduplicate per lead_id so each lead counts at most once per bucket.
  const inspSeen          = new Set<string>()
  const offSeen           = new Set<string>()
  const dakkapelDoorgezet = new Set<string>()

  for (const c of (changesData ?? []) as unknown as ChangeRow[]) {
    if (!c.leads) continue
    const niche = resolveNiche(c.leads.contractor_id, c.leads.board_id)
    if (!niche) continue

    // Dakkapel doorgezet: first routing event per lead wins
    if (niche === 'dakkapel' && DAKKAPEL_ROUTING_STATUSES.includes(c.to_status)
        && !dakkapelDoorgezet.has(c.lead_id)) {
      dakkapelDoorgezet.add(c.lead_id)
      byNiche.dakkapel.doorgezet++
      totals.doorgezet++
    }

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

// ── WasenderAPI ───────────────────────────────────────────────────────────────
// Endpoint: POST https://wasenderapi.com/api/send-message
// Auth:     Authorization: Bearer <WASENDER_API_KEY>
// Body:     { to: "<groupJID>@g.us", text: "<message>" }

async function sendWhatsApp(message: string): Promise<void> {
  const apiKey  = process.env.WASENDER_API_KEY?.trim()
  const groupId = process.env.WASENDER_GROUP_ID?.trim()  // WhatsApp group JID, e.g. "120363xxxxxx@g.us"

  if (!apiKey || !groupId) throw new Error('Missing WASENDER_API_KEY or WASENDER_GROUP_ID')

  const res = await fetch('https://wasenderapi.com/api/send-message', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify({ to: groupId, text: message }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`WasenderAPI error ${res.status}: ${text}`)
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now        = new Date()
  const params     = new URL(req.url).searchParams
  const force      = params.get('force') === 'true'
  const weekOffset = Math.max(0, parseInt(params.get('weekOffset') ?? '0', 10) || 0)
  const hour       = getAmsterdamHour(now)

  // Only execute at 11:xx Amsterdam time (bypass with ?force=true for testing)
  if (!force && hour !== 11) {
    return NextResponse.json({
      ok:      true,
      skipped: true,
      reason:  `Amsterdam hour is ${hour}, expected 11 — pass ?force=true to override`,
    })
  }

  try {
    const { from, to, label } = weekWindow(weekOffset)
    const { totals, byNiche } = await fetchWeekStats(from, to)
    const message = buildMessage(label, totals, byNiche)

    if (force && !process.env.WASENDER_API_KEY) {
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
