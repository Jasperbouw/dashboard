import { serverClient } from '../../lib/supabase-server'
import { LastSynced } from '../components/today/LastSynced'

export const dynamic = 'force-dynamic'

const NL_MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
]
const NICHE_ORDER  = ['bouw', 'daken', 'dakkapel', 'extras']
const NICHE_LABEL: Record<string, string> = {
  bouw: 'Bouw', daken: 'Daken', dakkapel: 'Dakkapel', extras: 'Extras',
}


// Raw Monday.com status strings per canonical stage — must match exactly.
const INSPECTION_STATUSES = ['Inspectie gepland']
const QUOTE_STATUSES      = ['Offerte verzonden', 'Offerte verstuurd', 'Laatste poging']
const WON_STATUSES        = ['Akkoord']

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function distinctLeads(rows: Array<{ lead_id: string | null }> | null): number {
  return new Set((rows ?? []).map(r => r.lead_id).filter(Boolean)).size
}

// ── UI primitives ──────────────────────────────────────────────────────────────

function SectionHeader({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {label}
      </div>
      {subtitle && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

function PulseCard({ label, value, prevValue, compareLabel, nicheBreakdown }: {
  label:           string
  value:           number
  prevValue:       number
  compareLabel:    string
  nicheBreakdown?: string
}) {
  const diff  = value - prevValue
  const color = diff > 0 ? '#3fb950' : diff < 0 ? '#f85149' : 'var(--color-ink-faint)'
  const sign  = diff > 0 ? '↑' : diff < 0 ? '↓' : '='

  return (
    <div style={{
      padding: '18px 20px', background: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{
        fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {nicheBreakdown && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 6px', marginTop: 6 }}>
          {nicheBreakdown.split(' · ').map((item, i, arr) => (
            <span key={item} style={{ whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
              {item}{i < arr.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </div>
      )}
      <div style={{ fontSize: 'var(--font-size-xs)', color, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
        {sign} {Math.abs(diff)} {compareLabel}
      </div>
    </div>
  )
}

function SimpleCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{
      padding: '18px 20px', background: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{
        fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ── Timing helper (server-side only, remove once investigation is done) ────────
async function timed<T>(label: string, p: PromiseLike<T>): Promise<T> {
  const t0 = Date.now()
  const result = await p
  console.log(`[today] ${label}: ${Date.now() - t0}ms`)
  return result
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function TodayPage() {
  const now = new Date()

  // ── Week date ranges (fair Mon-to-today comparison) ─────────────────────────
  const dayOfWeek      = now.getDay()             // 0 = Sun
  const daysSinceMon   = (dayOfWeek + 6) % 7      // 0 = Mon … 6 = Sun

  const thisMonStart = new Date(now)
  thisMonStart.setDate(now.getDate() - daysSinceMon)
  thisMonStart.setHours(0, 0, 0, 0)

  const thisCutoff   = new Date(now)
  thisCutoff.setHours(23, 59, 59, 999)

  const lastMonStart = new Date(thisMonStart.getTime() - 7 * 86_400_000)
  const lastCutoff   = new Date(thisCutoff.getTime()   - 7 * 86_400_000)

  // ── Month date ranges ────────────────────────────────────────────────────────
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const periodLabel = `${NL_MONTHS[now.getMonth()]} ${now.getFullYear()}`

  // ── Quarter date ranges (pending commission proxy) ───────────────────────────
  const qStartMonth  = Math.floor(now.getMonth() / 3) * 3
  const quarterStart = new Date(now.getFullYear(), qStartMonth, 1)
  const quarterEnd   = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59, 999)

  // ── Display labels ───────────────────────────────────────────────────────────
  const todayLabel      = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  const weekCompareLabel = 'vs vorige week'

  const db = serverClient()
  const pageT0 = Date.now()

  const [
    { data: lastRun },
    // Section 1: lead counts (head:true = count only, no data)
    { count: thisWeekLeads },
    { count: lastWeekLeads },
    // Section 1: stage transitions (fetch lead_id for distinct-lead counting)
    { data: twInsp },
    { data: lwInsp },
    { data: twQuote },
    { data: lwQuote },
    { data: twWon },
    { data: lwWon },
    // Section 2: month lead count
    { count: monthLeads },
    // Section 2: open stage snapshots (current state, no date filter)
    { count: openInsp },
    { count: openQuote },
    // Section 2: won transitions this month
    { data: monthWonRows },
    // Section 2: leads with niche info for breakdown text
    { data: monthLeadsRaw },
    { data: contractorsRaw },
    { data: boardsRaw },
    // Section 1 supplemental: this week's leads niche breakdown
    { data: thisWeekLeadsRaw },
    // Section 3: quarter deals (pending commission proxy)
    { data: qDealsRaw },
  ] = await Promise.all([
    timed('sync_runs',         db.from('sync_runs').select('started_at').order('started_at', { ascending: false }).limit(1).single()),

    // ── Section 1 ─────────────────────────────────────────────────
    timed('leads-this-week',   db.from('leads').select('*', { count: 'exact', head: true })
      .gte('monday_created_at', thisMonStart.toISOString())
      .lte('monday_created_at', thisCutoff.toISOString())),
    timed('leads-last-week',   db.from('leads').select('*', { count: 'exact', head: true })
      .gte('monday_created_at', lastMonStart.toISOString())
      .lte('monday_created_at', lastCutoff.toISOString())),

    timed('insp-this-week',    db.from('lead_status_changes').select('lead_id')
      .in('to_status', INSPECTION_STATUSES)
      .gte('changed_at', thisMonStart.toISOString())
      .lte('changed_at', thisCutoff.toISOString())),
    timed('insp-last-week',    db.from('lead_status_changes').select('lead_id')
      .in('to_status', INSPECTION_STATUSES)
      .gte('changed_at', lastMonStart.toISOString())
      .lte('changed_at', lastCutoff.toISOString())),

    timed('quote-this-week',   db.from('lead_status_changes').select('lead_id')
      .in('to_status', QUOTE_STATUSES)
      .gte('changed_at', thisMonStart.toISOString())
      .lte('changed_at', thisCutoff.toISOString())),
    timed('quote-last-week',   db.from('lead_status_changes').select('lead_id')
      .in('to_status', QUOTE_STATUSES)
      .gte('changed_at', lastMonStart.toISOString())
      .lte('changed_at', lastCutoff.toISOString())),

    timed('won-this-week',     db.from('lead_status_changes').select('lead_id')
      .in('to_status', WON_STATUSES)
      .gte('changed_at', thisMonStart.toISOString())
      .lte('changed_at', thisCutoff.toISOString())),
    timed('won-last-week',     db.from('lead_status_changes').select('lead_id')
      .in('to_status', WON_STATUSES)
      .gte('changed_at', lastMonStart.toISOString())
      .lte('changed_at', lastCutoff.toISOString())),

    // ── Section 2 ─────────────────────────────────────────────────
    timed('leads-this-month',  db.from('leads').select('*', { count: 'exact', head: true })
      .gte('monday_created_at', monthStart.toISOString())
      .lte('monday_created_at', monthEnd.toISOString())),

    timed('open-insp-snap',    db.from('leads').select('*', { count: 'exact', head: true })
      .eq('canonical_stage', 'inspection')),
    timed('open-quote-snap',   db.from('leads').select('*', { count: 'exact', head: true })
      .eq('canonical_stage', 'quote_sent')),

    timed('won-this-month',    db.from('lead_status_changes').select('lead_id')
      .in('to_status', WON_STATUSES)
      .gte('changed_at', monthStart.toISOString())
      .lte('changed_at', monthEnd.toISOString())),

    timed('month-leads-niche', db.from('leads').select('contractor_id, board_id')
      .gte('monday_created_at', monthStart.toISOString())
      .lte('monday_created_at', monthEnd.toISOString())
      .limit(3000)),
    timed('contractors',       db.from('contractors').select('id, niche')),
    timed('boards-config',     db.from('boards_config').select('id, niche')),

    // Section 1 supplemental: this week's leads with niche info (for leads card breakdown)
    timed('week-leads-niche',  db.from('leads').select('contractor_id, board_id')
      .gte('monday_created_at', thisMonStart.toISOString())
      .lte('monday_created_at', thisCutoff.toISOString())
      .limit(2000)),

    // ── Section 3 ─────────────────────────────────────────────────
    // TODO: add payment_status to closed_deals so only genuinely unpaid deals
    // are shown here. Until then, all deals from current quarter serve as a proxy.
    timed('quarter-deals',     db.from('closed_deals')
      .select('id, client_name, deal_value, commission_amount, closed_at')
      .gte('closed_at', quarterStart.toISOString().slice(0, 10))
      .lte('closed_at', quarterEnd.toISOString().slice(0, 10))
      .order('commission_amount', { ascending: false })),
  ])
  console.log(`[today] total-db: ${Date.now() - pageT0}ms`)

  // ── Derived values ───────────────────────────────────────────────────────────

  // Section 1
  const twInspCount  = distinctLeads(twInsp)
  const lwInspCount  = distinctLeads(lwInsp)
  const twQuoteCount = distinctLeads(twQuote)
  const lwQuoteCount = distinctLeads(lwQuote)
  const twWonCount   = distinctLeads(twWon)
  const lwWonCount   = distinctLeads(lwWon)

  // Shared niche lookup maps (reused for both week and month breakdowns)
  const contractorNiche = new Map<string, string>(
    (contractorsRaw ?? []).filter(c => c.niche).map(c => [c.id, c.niche as string]),
  )
  const boardNiche = new Map<number, string>(
    (boardsRaw ?? []).filter(b => b.niche).map(b => [b.id as number, b.niche as string]),
  )

  function leadsToNicheCount(rows: Array<{ contractor_id: string | null; board_id: number | null }> | null) {
    const counts: Record<string, number> = {}
    for (const l of rows ?? []) {
      const niche = l.contractor_id
        ? (contractorNiche.get(l.contractor_id) ?? null)
        : (l.board_id != null ? (boardNiche.get(l.board_id) ?? null) : null)
      if (niche) counts[niche] = (counts[niche] ?? 0) + 1
    }
    return counts
  }

  // Section 1 — week niche breakdown (sorted by count desc, no colon)
  const weekNicheCount = leadsToNicheCount(thisWeekLeadsRaw as Array<{ contractor_id: string | null; board_id: number | null }> | null)
  const weekNicheText = [...NICHE_ORDER]
    .filter(n => (weekNicheCount[n] ?? 0) > 0)
    .sort((a, b) => (weekNicheCount[b] ?? 0) - (weekNicheCount[a] ?? 0))
    .map(n => `${NICHE_LABEL[n]} ${weekNicheCount[n]}`)
    .join(' · ')

  // Section 2 — month niche breakdown
  const nicheCount = leadsToNicheCount(monthLeadsRaw as Array<{ contractor_id: string | null; board_id: number | null }> | null)
  const nicheText = NICHE_ORDER
    .filter(n => (nicheCount[n] ?? 0) > 0)
    .map(n => `${NICHE_LABEL[n]}: ${nicheCount[n]}`)
    .join(' · ')

  const monthWonCount = distinctLeads(monthWonRows)

  // Section 3
  const qDeals               = qDealsRaw ?? []
  const totalPendingComm     = qDeals.reduce((s, d) => s + Number(d.commission_amount), 0)
  const top3                 = qDeals.slice(0, 3)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
          Today
        </h1>
        <p style={{
          fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)',
          marginTop: 4, display: 'flex', alignItems: 'center', gap: 8,
          textTransform: 'capitalize',
        }}>
          {todayLabel}
          <LastSynced syncedAt={lastRun?.started_at ?? null} />
        </p>
      </div>

      {/* ── Section 1: Week vergelijking ─────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader label="Deze week" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <PulseCard label="Leads ontvangen"    value={thisWeekLeads ?? 0} prevValue={lastWeekLeads ?? 0} compareLabel={weekCompareLabel} nicheBreakdown={weekNicheText || undefined} />
          <PulseCard label="Inspecties gepland" value={twInspCount}        prevValue={lwInspCount}        compareLabel={weekCompareLabel} />
          <PulseCard label="Offertes verzonden" value={twQuoteCount}       prevValue={lwQuoteCount}       compareLabel={weekCompareLabel} />
          <PulseCard label="Wins"               value={twWonCount}         prevValue={lwWonCount}         compareLabel={weekCompareLabel} />
        </div>
      </div>

      {/* ── Section 2: Maand pipeline status ────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader label={periodLabel} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: nicheText ? 12 : 0 }}>
          <SimpleCard label="Leads ontvangen"   value={monthLeads ?? 0} />
          <SimpleCard label="Open inspecties"   value={openInsp ?? 0}   sub="Huidige pipeline" />
          <SimpleCard label="Open offertes"     value={openQuote ?? 0}  sub="Huidige pipeline" />
          <SimpleCard label="Wins deze maand"   value={monthWonCount} />
        </div>
        {nicheText && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
            {nicheText}
          </div>
        )}
      </div>

      {/* ── Section 3: Commissie pending ────────────────────────────────────── */}
      <div>
        <SectionHeader label="Commissie pending" />
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '18px 20px',
        }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
            {fmtEur(totalPendingComm)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginBottom: top3.length > 0 ? 16 : 0 }}>
            {/* TODO: add payment_status to closed_deals to show only genuinely unpaid deals */}
            Gesloten deals dit kwartaal — schatting, betalingsstatus wordt nog niet bijgehouden
          </div>

          {top3.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {top3.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-ink)' }}>
                      {d.client_name}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginLeft: 8 }}>
                      {new Date(d.closed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
                      {fmtEur(Number(d.deal_value))} deal ·{' '}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-success)' }}>
                      {fmtEur(Number(d.commission_amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
