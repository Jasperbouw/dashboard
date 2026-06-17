import { serverClient } from '../../lib/supabase-server'
import { LastSynced } from '../components/today/LastSynced'

export const dynamic = 'force-dynamic'

const NL_MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
]
const NICHE_ORDER = ['bouw', 'daken', 'dakkapel', 'extras']
const NICHE_LABEL: Record<string, string> = {
  bouw: 'Bouw', daken: 'Daken', dakkapel: 'Dakkapel', extras: 'Extras',
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default async function HomePage() {
  const now = new Date()

  const daysSinceMon = (now.getDay() + 6) % 7
  const thisMonStart = new Date(now)
  thisMonStart.setDate(now.getDate() - daysSinceMon)
  thisMonStart.setHours(0, 0, 0, 0)
  const thisCutoff   = new Date(now)
  thisCutoff.setHours(23, 59, 59, 999)

  const lastMonStart = new Date(thisMonStart.getTime() - 7 * 86_400_000)
  const lastCutoff   = new Date(thisCutoff.getTime()   - 7 * 86_400_000)

  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const periodLabel = `${NL_MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const todayLabel  = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

  const db = serverClient()

  const [
    { data: lastRun },
    { count: thisWeekLeads },
    { count: lastWeekLeads },
    { count: monthLeads },
    { data: thisWeekLeadsRaw },
    // canonical_stage included for qualifying ratio
    { data: monthLeadsRaw },
    { data: contractorsRaw },
    { data: boardsRaw },
    { data: monthDeals },
    { data: ytdDeals },
    { data: openCommDeals },
  ] = await Promise.all([
    db.from('sync_runs').select('started_at').order('started_at', { ascending: false }).limit(1).single(),
    db.from('leads').select('*', { count: 'exact', head: true })
      .gte('monday_created_at', thisMonStart.toISOString())
      .lte('monday_created_at', thisCutoff.toISOString()),
    db.from('leads').select('*', { count: 'exact', head: true })
      .gte('monday_created_at', lastMonStart.toISOString())
      .lte('monday_created_at', lastCutoff.toISOString()),
    db.from('leads').select('*', { count: 'exact', head: true })
      .gte('monday_created_at', monthStart.toISOString())
      .lte('monday_created_at', monthEnd.toISOString()),
    db.from('leads').select('contractor_id, board_id')
      .gte('monday_created_at', thisMonStart.toISOString())
      .lte('monday_created_at', thisCutoff.toISOString())
      .limit(2000),
    db.from('leads').select('contractor_id, board_id, canonical_stage')
      .gte('monday_created_at', monthStart.toISOString())
      .lte('monday_created_at', monthEnd.toISOString())
      .limit(3000),
    db.from('contractors').select('id, niche'),
    db.from('boards_config').select('id, niche'),
    db.from('closed_deals').select('deal_value')
      .gte('closed_at', monthStart.toISOString().slice(0, 10))
      .lte('closed_at', monthEnd.toISOString().slice(0, 10)),
    db.from('closed_deals').select('deal_value')
      .gte('closed_at', `${now.getFullYear()}-01-01`)
      .lte('closed_at', now.toISOString().slice(0, 10)),
    db.from('closed_deals').select('commission_amount, commission_received_amount'),
  ])

  // Niche lookup
  const contractorNiche = new Map<string, string>(
    (contractorsRaw ?? []).filter(c => c.niche).map(c => [c.id, c.niche as string]),
  )
  const boardNiche = new Map<number, string>(
    (boardsRaw ?? []).filter(b => b.niche).map(b => [b.id as number, b.niche as string]),
  )

  function resolveNiche(row: { contractor_id: string | null; board_id: number | null }): string | null {
    return row.contractor_id
      ? (contractorNiche.get(row.contractor_id) ?? null)
      : (row.board_id != null ? (boardNiche.get(row.board_id) ?? null) : null)
  }

  // Week niche breakdown (display only)
  const weekNicheText = (() => {
    const counts: Record<string, number> = {}
    for (const l of thisWeekLeadsRaw ?? []) {
      const n = resolveNiche(l as { contractor_id: string | null; board_id: number | null })
      if (n) counts[n] = (counts[n] ?? 0) + 1
    }
    return NICHE_ORDER.filter(n => (counts[n] ?? 0) > 0).map(n => `${NICHE_LABEL[n]} ${counts[n]}`).join(' · ')
  })()

  // Month niche breakdown + qualifying ratio per niche
  const monthNicheText = (() => {
    const counts: Record<string, number> = {}
    for (const l of monthLeadsRaw ?? []) {
      const n = resolveNiche(l as { contractor_id: string | null; board_id: number | null })
      if (n) counts[n] = (counts[n] ?? 0) + 1
    }
    return NICHE_ORDER.filter(n => (counts[n] ?? 0) > 0).map(n => `${NICHE_LABEL[n]} ${counts[n]}`).join(' · ')
  })()

  // Qualifying ratio: leads that progressed past 'new' and didn't end as 'lost', per niche
  const qualRatio = (() => {
    type LeadRow = { contractor_id: string | null; board_id: number | null; canonical_stage: string | null }
    const total:     Record<string, number> = {}
    const qualified: Record<string, number> = {}
    for (const l of (monthLeadsRaw ?? []) as LeadRow[]) {
      const n = resolveNiche(l)
      if (!n) continue
      total[n] = (total[n] ?? 0) + 1
      // Bouw/Daken: doorgezet = assigned to contractor board (contractor_id set)
      // Dakkapel/Extras: use canonical_stage progression
      const isQual = (n === 'bouw' || n === 'daken')
        ? (l.contractor_id != null && l.canonical_stage !== 'lost')
        : (!!l.canonical_stage && l.canonical_stage !== 'new' && l.canonical_stage !== 'lost')
      if (isQual) qualified[n] = (qualified[n] ?? 0) + 1
    }
    return NICHE_ORDER
      .filter(n => (total[n] ?? 0) > 0)
      .map(n => ({
        label: NICHE_LABEL[n] ?? n,
        pct:   total[n] > 0 ? Math.round(((qualified[n] ?? 0) / total[n]) * 100) : 0,
        total: total[n],
      }))
  })()

  // Omzet deze maand + YTD + openstaande commissie
  const omzetMaand        = (monthDeals    ?? []).reduce((s, d) => s + Number(d.deal_value), 0)
  const omzetYTD          = (ytdDeals      ?? []).reduce((s, d) => s + Number(d.deal_value), 0)
  const openstaandeComm   = (openCommDeals ?? []).reduce((s, d) => s + Math.max(0, Number(d.commission_amount) - Number(d.commission_received_amount ?? 0)), 0)

  const weekDiff  = (thisWeekLeads ?? 0) - (lastWeekLeads ?? 0)
  const diffColor = weekDiff > 0 ? '#3fb950' : weekDiff < 0 ? '#f85149' : 'var(--color-ink-faint)'
  const diffSign  = weekDiff > 0 ? '↑' : weekDiff < 0 ? '↓' : '='

  const card: React.CSSProperties = {
    padding: '24px 26px', background: 'var(--color-surface)',
    border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)',
  }
  const cardLabel: React.CSSProperties = {
    fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
  }
  const cardValue: React.CSSProperties = {
    fontSize: 48, fontWeight: 700, color: 'var(--color-ink)',
    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
  }
  const cardSub: React.CSSProperties = {
    fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', marginTop: 10,
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
          Home
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'capitalize' }}>
          {todayLabel}
          <LastSynced syncedAt={lastRun?.started_at ?? null} />
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Leads deze week */}
        <div style={card}>
          <div style={cardLabel}>Leads deze week</div>
          <div style={cardValue}>{thisWeekLeads ?? 0}</div>
          {weekNicheText && <div style={cardSub}>{weekNicheText}</div>}
          <div style={{ ...cardSub, color: diffColor, marginTop: weekNicheText ? 6 : 10 }}>
            {diffSign} {Math.abs(weekDiff)} vs vorige week
          </div>
        </div>

        {/* Leads deze maand */}
        <div style={card}>
          <div style={cardLabel}>Leads {periodLabel}</div>
          <div style={cardValue}>{monthLeads ?? 0}</div>
          {monthNicheText && <div style={cardSub}>{monthNicheText}</div>}
        </div>

        {/* Omzet deze maand + YTD */}
        <div style={card}>
          <div style={cardLabel}>Omzet {periodLabel}</div>
          <div style={{ ...cardValue, fontSize: 36 }}>
            {omzetMaand > 0 ? fmtEur(omzetMaand) : '—'}
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>
              <span>YTD {now.getFullYear()}</span>
              <span style={{ color: 'var(--color-ink-muted)', fontVariantNumeric: 'tabular-nums' }}>{omzetYTD > 0 ? fmtEur(omzetYTD) : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>
              <span>Openstaande commissie</span>
              <span style={{ color: openstaandeComm > 0 ? '#3fb950' : 'var(--color-ink-faint)', fontVariantNumeric: 'tabular-nums' }}>{openstaandeComm > 0 ? fmtEur(openstaandeComm) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Qualifying ratio per branche */}
        <div style={card}>
          <div style={cardLabel}>Qualifying ratio {periodLabel}</div>
          {qualRatio.length === 0 ? (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-faint)', marginTop: 8 }}>Geen data</div>
          ) : (() => {
            const maxPct = Math.max(...qualRatio.map(r => r.pct), 1)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                {qualRatio.map(({ label, pct, total }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--color-surface-raised)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.round((pct / maxPct) * 100)}%`, borderRadius: 3,
                        background: '#3fb950',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 3 }}>
                      {total} leads
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

      </div>
    </div>
  )
}
