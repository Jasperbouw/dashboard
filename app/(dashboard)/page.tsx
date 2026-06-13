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

export default async function HomePage() {
  const now = new Date()

  // Week window: Monday 00:00 → now (UTC-based, good enough for display)
  const daysSinceMon = (now.getDay() + 6) % 7
  const thisMonStart = new Date(now)
  thisMonStart.setDate(now.getDate() - daysSinceMon)
  thisMonStart.setHours(0, 0, 0, 0)
  const thisCutoff   = new Date(now)
  thisCutoff.setHours(23, 59, 59, 999)

  const lastMonStart = new Date(thisMonStart.getTime() - 7 * 86_400_000)
  const lastCutoff   = new Date(thisCutoff.getTime()   - 7 * 86_400_000)

  // Month window
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const periodLabel = `${NL_MONTHS[now.getMonth()]} ${now.getFullYear()}`

  const todayLabel = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

  const db = serverClient()

  const [
    { data: lastRun },
    { count: thisWeekLeads },
    { count: lastWeekLeads },
    { count: monthLeads },
    { data: thisWeekLeadsRaw },
    { data: monthLeadsRaw },
    { data: contractorsRaw },
    { data: boardsRaw },
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
    db.from('leads').select('contractor_id, board_id')
      .gte('monday_created_at', monthStart.toISOString())
      .lte('monday_created_at', monthEnd.toISOString())
      .limit(3000),
    db.from('contractors').select('id, niche'),
    db.from('boards_config').select('id, niche'),
  ])

  // Niche lookup
  const contractorNiche = new Map<string, string>(
    (contractorsRaw ?? []).filter(c => c.niche).map(c => [c.id, c.niche as string]),
  )
  const boardNiche = new Map<number, string>(
    (boardsRaw ?? []).filter(b => b.niche).map(b => [b.id as number, b.niche as string]),
  )

  function nicheBreakdown(rows: Array<{ contractor_id: string | null; board_id: number | null }> | null) {
    const counts: Record<string, number> = {}
    for (const l of rows ?? []) {
      const niche = l.contractor_id
        ? (contractorNiche.get(l.contractor_id) ?? null)
        : (l.board_id != null ? (boardNiche.get(l.board_id) ?? null) : null)
      if (niche) counts[niche] = (counts[niche] ?? 0) + 1
    }
    return NICHE_ORDER
      .filter(n => (counts[n] ?? 0) > 0)
      .map(n => `${NICHE_LABEL[n]} ${counts[n]}`)
      .join(' · ')
  }

  const weekNicheText  = nicheBreakdown(thisWeekLeadsRaw as Array<{ contractor_id: string | null; board_id: number | null }> | null)
  const monthNicheText = nicheBreakdown(monthLeadsRaw    as Array<{ contractor_id: string | null; board_id: number | null }> | null)

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
          {weekNicheText && (
            <div style={cardSub}>{weekNicheText}</div>
          )}
          <div style={{ ...cardSub, color: diffColor, marginTop: weekNicheText ? 6 : 10 }}>
            {diffSign} {Math.abs(weekDiff)} vs vorige week
          </div>
        </div>

        {/* Leads deze maand */}
        <div style={card}>
          <div style={cardLabel}>Leads {periodLabel}</div>
          <div style={cardValue}>{monthLeads ?? 0}</div>
          {monthNicheText && (
            <div style={cardSub}>{monthNicheText}</div>
          )}
        </div>

      </div>
    </div>
  )
}
