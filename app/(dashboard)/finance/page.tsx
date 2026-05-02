import { serverClient } from '../../../lib/supabase-server'
import { getActiveContractors } from '../../../lib/metrics'
import { FinanceCharts } from '../../components/finance/FinanceCharts'
import { MonthPicker } from '../../components/finance/MonthPicker'
import { TargetsSection } from '../../components/finance/TargetsSection'

export const dynamic = 'force-dynamic'

const NL_MONTHS = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
const NICHE_LABELS: Record<string, string> = { bouw: 'Bouw', daken: 'Daken', dakkapel: 'Dakkapel', extras: 'Extras', overig: 'Overig' }

interface Props {
  searchParams: Promise<{ month?: string }>
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function targetProgress(actual: number, target: number | null | undefined) {
  if (!target || target <= 0) return null
  const pct   = Math.round((actual / target) * 100)
  const color = actual >= target ? '#3fb950' : actual > 0 ? '#58a6ff' : '#6e7681'
  return { pct, target, color }
}

export default async function FinancePage({ searchParams }: Props) {
  const params = await searchParams

  const now          = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth()
  const maxMonthKey  = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`

  let selYear: number
  let selMonth: number

  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [py, pm] = params.month.split('-').map(Number)
    const maxOrd   = currentYear * 12 + currentMonth
    const minOrd   = maxOrd - 11
    const clamped  = Math.max(minOrd, Math.min(maxOrd, py * 12 + (pm - 1)))
    selYear  = Math.floor(clamped / 12)
    selMonth = clamped % 12
  } else {
    selYear  = currentYear
    selMonth = currentMonth
  }

  const selectedMonthKey   = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`
  const isCurrentMonth     = selectedMonthKey === maxMonthKey
  const selectedMonthLabel = NL_MONTHS[selMonth]
  const periodLabel        = `${selectedMonthLabel} ${selYear}`

  const monthStartDate = new Date(selYear, selMonth, 1).toISOString().slice(0, 10)
  const monthEndDate   = new Date(selYear, selMonth + 1, 0).toISOString().slice(0, 10)

  // 6-month trend window
  const trendStart     = new Date(selYear, selMonth - 5, 1)
  const trendStartDate = trendStart.toISOString().slice(0, 10)

  // YTD high-value niches (bouw + new high-value; excl. daken & dakkapel)
  const ytdStart = `${currentYear}-01-01`
  const ytdEnd   = now.toISOString().slice(0, 10)
  const YTD_NICHES = ['bouw', 'zwembaden', 'pergolas', 'nieuwbouw']

  const db = serverClient()
  const contractors = await getActiveContractors()

  const [
    { data: dealsRaw },
    { data: adBudgetRaw },
    { data: metaSpendRow },
    { data: targetsRow },
    { data: trendDealsRaw },
    { data: ytdDealsRaw },
  ] = await Promise.all([
    db.from('closed_deals')
      .select('deal_value, commission_amount, contractor_id, niche, closed_at')
      .gte('closed_at', monthStartDate)
      .lte('closed_at', monthEndDate),
    db.from('ad_budget_revenue')
      .select('amount, contractor_id, received_at')
      .gte('received_at', monthStartDate)
      .lte('received_at', monthEndDate),
    db.from('meta_spend_monthly')
      .select('amount_eur')
      .eq('year_month', `${selectedMonthKey}-01`)
      .maybeSingle(),
    db.from('monthly_targets')
      .select('*')
      .eq('month', selectedMonthKey)
      .maybeSingle(),
    db.from('closed_deals')
      .select('commission_amount, closed_at')
      .gte('closed_at', trendStartDate)
      .lte('closed_at', monthEndDate),
    db.from('closed_deals')
      .select('deal_value, commission_amount')
      .gte('closed_at', ytdStart)
      .lte('closed_at', ytdEnd)
      .in('niche', YTD_NICHES),
  ])

  type DealRow = { deal_value: number; commission_amount: number; contractor_id: string | null; niche: string | null; closed_at: string }
  type ABRow   = { amount: number; contractor_id: string | null; received_at: string }

  const deals    = (dealsRaw    ?? []) as DealRow[]
  const adBudget = (adBudgetRaw ?? []) as ABRow[]
  const trendDeals = (trendDealsRaw ?? []) as { commission_amount: number; closed_at: string }[]

  // Hero stats
  const totalDealValue  = deals.reduce((s, d) => s + Number(d.deal_value), 0)
  const totalCommission = deals.reduce((s, d) => s + Number(d.commission_amount), 0)
  const dealCount       = deals.length
  const avgCommPct      = totalDealValue > 0 ? (totalCommission / totalDealValue * 100) : 0
  const totalAdBudget   = adBudget.reduce((s, a) => s + Number(a.amount), 0)
  const metaSpendAmt    = Number(metaSpendRow?.amount_eur ?? 0)
  const adPnL           = totalAdBudget - metaSpendAmt

  // Targets
  const targets = targetsRow as { deal_value_target: number | null; commission_target: number | null; ad_budget_target: number | null } | null

  const dealProgress  = targetProgress(totalDealValue,  targets?.deal_value_target)
  const commProgress  = targetProgress(totalCommission, targets?.commission_target)
  const adBudProgress = targetProgress(totalAdBudget,   targets?.ad_budget_target)

  // 6-month trend (commission)
  const trendMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(selYear, selMonth - i, 1)
    trendMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
  }
  for (const d of trendDeals) {
    const key = d.closed_at.slice(0, 7)
    if (key in trendMap) trendMap[key] += Number(d.commission_amount)
  }
  const trend = Object.entries(trendMap).map(([mo, amount]) => ({
    month: mo,
    label: NL_MONTHS[parseInt(mo.split('-')[1]) - 1],
    amount,
  }))

  // By niche (commission)
  const NICHE_ORDER = ['bouw', 'daken', 'dakkapel', 'extras']
  const byNicheRaw: Record<string, number> = Object.fromEntries(NICHE_ORDER.map(n => [n, 0]))
  for (const d of deals) {
    const niche = d.niche ?? 'overig'
    byNicheRaw[niche] = (byNicheRaw[niche] ?? 0) + Number(d.commission_amount)
  }
  const byNiche = NICHE_ORDER.map(n => ({ name: n, label: NICHE_LABELS[n] ?? n, amount: byNicheRaw[n] ?? 0 }))

  // Top 5 contractors (commission)
  const contCommMap: Record<string, number> = {}
  for (const d of deals) {
    if (!d.contractor_id) continue
    contCommMap[d.contractor_id] = (contCommMap[d.contractor_id] ?? 0) + Number(d.commission_amount)
  }
  const top5 = contractors
    .map(c => ({ id: c.id, name: c.name, niche: c.niche ?? '', model: c.commission_model ?? '', amount: contCommMap[c.id] ?? 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // YTD stats
  type YtdRow = { deal_value: number; commission_amount: number }
  const ytdDeals         = (ytdDealsRaw ?? []) as YtdRow[]
  const ytdCount         = ytdDeals.length
  const ytdTotalDealValue = ytdDeals.reduce((s, d) => s + Number(d.deal_value), 0)
  const ytdTotalComm      = ytdDeals.reduce((s, d) => s + Number(d.commission_amount), 0)
  const ytdAvgDealValue   = ytdCount > 0 ? Math.round(ytdTotalDealValue / ytdCount) : 0
  const ytdEmpty          = ytdCount === 0

  type ProgressInfo = { pct: number; target: number; color: string } | null

  function ProgressBar({ prog }: { prog: ProgressInfo }) {
    if (!prog) return null
    const fill = Math.min(prog.pct, 100)
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ height: 4, background: 'var(--color-border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${fill}%`, height: '100%', background: prog.color, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 'var(--font-size-2xs)', color: prog.color, marginTop: 4 }}>
          {prog.pct}% van {fmtEur(prog.target)} doel
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>Finance</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
            Closed deals, commissie en ad budget
          </p>
        </div>
        <MonthPicker value={selectedMonthKey} max={maxMonthKey} />
      </div>

      {/* 4 hero cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>

        {/* Card 1: Deal value */}
        <div style={{ padding: '18px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Closed deals {periodLabel}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtEur(totalDealValue)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
            {dealCount} deal{dealCount !== 1 ? 's' : ''} geland
          </div>
          <ProgressBar prog={dealProgress} />
        </div>

        {/* Card 2: Commission */}
        <div style={{ padding: '18px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Commissie {periodLabel}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtEur(totalCommission)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
            Gem. {avgCommPct.toFixed(1)}% commissie
          </div>
          <ProgressBar prog={commProgress} />
        </div>

        {/* Card 3: Ad budget revenue */}
        <div style={{ padding: '18px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Ad Budget Revenue {periodLabel}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtEur(totalAdBudget)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
            {periodLabel}
          </div>
          <ProgressBar prog={adBudProgress} />
        </div>

        {/* Card 4: Meta ad spend + P&L */}
        <div style={{ padding: '18px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Meta Ad Spend {periodLabel}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtEur(metaSpendAmt)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 4, color: adPnL >= 0 ? '#3fb950' : '#f85149' }}>
            {adPnL >= 0 ? '+' : '−'}{fmtEur(Math.abs(adPnL))} {adPnL >= 0 ? 'surplus' : 'tekort'}
          </div>
        </div>
      </div>

      {/* Targets section */}
      <TargetsSection
        month={selectedMonthKey}
        initial={targets}
        periodLabel={periodLabel}
      />

      {/* YTD — Bouw & high-value niches */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            YTD — Bouw &amp; high-value niches
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', marginTop: 2 }}>
            1 jan – vandaag · excl. daken &amp; dakkapel
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Gemiddelde deal value',       value: ytdEmpty ? '—' : fmtEur(ytdAvgDealValue),   sub: 'Gem. per deal' },
            { label: 'Totale omzet bouwbedrijven',  value: ytdEmpty ? '—' : fmtEur(ytdTotalDealValue), sub: 'Deal waarde YTD' },
            { label: 'Onze commissie',              value: ytdEmpty ? '—' : fmtEur(ytdTotalComm),      sub: 'Commissie YTD' },
            { label: 'Aantal deals',                value: ytdEmpty ? '—' : String(ytdCount),           sub: 'Gesloten dit jaar' },
          ].map(c => (
            <div key={c.label} style={{ padding: '18px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
                {c.value}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
                {c.sub}
              </div>
            </div>
          ))}
        </div>
        {ytdEmpty && (
          <div style={{ marginTop: 10, fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
            Nog geen high-value deals dit jaar.
          </div>
        )}
      </div>

      {/* Charts */}
      <FinanceCharts
        trend={trend}
        byNiche={byNiche}
        top5={top5}
        selectedMonth={selectedMonthKey}
        periodLabel={periodLabel}
      />
    </div>
  )
}
