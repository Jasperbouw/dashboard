import { serverClient } from '../../lib/supabase-server'
import { LastSynced } from '../components/today/LastSynced'

export const dynamic = 'force-dynamic'

const NL_MONTHS = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}


interface SnapshotCard {
  label:     string
  actual:    number
  target:    number | null | undefined
  subtitle:  string
  prefix?:   string
}

function MonthCard({ card }: { card: SnapshotCard }) {
  const hasTarget = card.target && card.target > 0
  const pct   = hasTarget ? Math.round((card.actual / card.target!) * 100) : 0
  const color = card.actual >= (card.target ?? Infinity) ? '#3fb950' : card.actual > 0 ? '#58a6ff' : '#6e7681'

  return (
    <div style={{
      padding: '20px',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        {card.label}
      </div>
      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
        {fmtEur(card.actual)}
        {hasTarget && (
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--color-ink-muted)', marginLeft: 6 }}>
            / {fmtEur(card.target!)}
          </span>
        )}
      </div>
      {hasTarget && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 4, background: 'var(--color-border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xs)', color, marginTop: 4 }}>
            {pct}% van {fmtEur(card.target!)} doel
          </div>
        </div>
      )}
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 8 }}>
        {card.subtitle}
      </div>
    </div>
  )
}

export default async function TodayPage() {
  const now        = new Date()
  const year       = now.getFullYear()
  const month      = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const daysLeft   = daysInMonth - dayOfMonth

  const monthKey   = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthStart = `${monthKey}-01`
  const monthEnd   = new Date(year, month + 1, 0).toISOString().slice(0, 10)
  const periodLabel = `${NL_MONTHS[month]} ${year}`

  const todayLabel = now.toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const db = serverClient()

  const [
    { data: lastRun },
    { data: dealsRaw },
    { data: adBudgetRaw },
    { data: targetsRow },
  ] = await Promise.all([
    db.from('sync_runs').select('started_at').order('started_at', { ascending: false }).limit(1).single(),
    db.from('closed_deals').select('deal_value, commission_amount').gte('closed_at', monthStart).lte('closed_at', monthEnd),
    db.from('ad_budget_revenue').select('amount').gte('received_at', monthStart).lte('received_at', monthEnd),
    db.from('monthly_targets').select('deal_value_target, commission_target, ad_budget_target').eq('month', monthKey).maybeSingle(),
  ])

  const deals = dealsRaw ?? []
  const totalDealValue  = deals.reduce((s, d) => s + Number(d.deal_value), 0)
  const totalCommission = deals.reduce((s, d) => s + Number(d.commission_amount), 0)
  const dealCount       = deals.length
  const avgCommPct      = totalDealValue > 0 ? (totalCommission / totalDealValue * 100) : 0
  const totalAdBudget   = (adBudgetRaw ?? []).reduce((s, a) => s + Number(a.amount), 0)

  const targets = targetsRow ?? null

  const cards: SnapshotCard[] = [
    {
      label:    'Closed Deals waarde',
      actual:   totalDealValue,
      target:   targets?.deal_value_target,
      subtitle: `${dealCount} deal${dealCount !== 1 ? 's' : ''} geland`,
    },
    {
      label:    'Commissie',
      actual:   totalCommission,
      target:   targets?.commission_target,
      subtitle: `Gem. ${avgCommPct.toFixed(1)}% commissie deze maand`,
    },
    {
      label:    'Ad Budget Revenue',
      actual:   totalAdBudget,
      target:   targets?.ad_budget_target,
      subtitle: periodLabel,
    },
  ]

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
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

      {/* Maand Snapshot */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16,
        }}>
          {periodLabel}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {cards.map(c => (
            <MonthCard key={c.label} card={c} />
          ))}
        </div>
        <div style={{ marginTop: 14, fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
          Dagen tot maand-einde: {daysLeft}
        </div>
      </div>
    </div>
  )
}
