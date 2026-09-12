import { serverClient } from '../../../lib/supabase-server'
import { getActiveContractors } from '../../../lib/metrics'
import { FinanceCharts } from '../../components/finance/FinanceCharts'
import { MonthPicker } from '../../components/finance/MonthPicker'

export const dynamic = 'force-dynamic'

const NL_MONTHS = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

interface Props {
  searchParams: Promise<{ month?: string }>
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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
  const selectedMonthLabel = NL_MONTHS[selMonth]
  const periodLabel        = `${selectedMonthLabel} ${selYear}`

  const monthStartDate = new Date(selYear, selMonth, 1).toISOString().slice(0, 10)
  const monthEndDate   = new Date(selYear, selMonth + 1, 0).toISOString().slice(0, 10)

  // 6-month trend window
  const trendStartDate = new Date(selYear, selMonth - 5, 1).toISOString().slice(0, 10)

  const ytdStart = `${currentYear}-01-01`
  const ytdEnd   = now.toISOString().slice(0, 10)

  const db          = serverClient()
  const contractors = await getActiveContractors()

  const [
    { data: dealsRaw },
    { data: adBudgetRaw },
    { data: metaSpendRow },
    { data: trendDealsRaw },
    { data: ytdDealsRaw },
    { data: openCommRaw },
    { data: gtMonthRaw },
    { data: gtTrendRaw },
    { data: gtOpenCommRaw },
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
    db.from('closed_deals')
      .select('commission_amount, closed_at')
      .gte('closed_at', trendStartDate)
      .lte('closed_at', monthEndDate),
    db.from('closed_deals')
      .select('deal_value, commission_amount, contractor_id')
      .gte('closed_at', ytdStart)
      .lte('closed_at', ytdEnd),
    db.from('closed_deals')
      .select('commission_amount, commission_received_amount'),
    db.from('greenteam_deals')
      .select('deal_value, commission_amount')
      .gte('closed_at', monthStartDate)
      .lte('closed_at', monthEndDate)
      .eq('status', 'akkoord'),
    db.from('greenteam_deals')
      .select('commission_amount, closed_at')
      .gte('closed_at', trendStartDate)
      .lte('closed_at', monthEndDate)
      .eq('status', 'akkoord'),
    db.from('greenteam_deals')
      .select('commission_amount, commission_received_amount'),
  ])

  type DealRow = { deal_value: number; commission_amount: number; contractor_id: string | null; niche: string | null; closed_at: string }
  type ABRow   = { amount: number; contractor_id: string | null; received_at: string }

  const deals      = (dealsRaw    ?? []) as DealRow[]
  const adBudget   = (adBudgetRaw ?? []) as ABRow[]
  const trendDeals = (trendDealsRaw ?? []) as { commission_amount: number; closed_at: string }[]

  // Openstaande commissie (all-time, both)
  const openstaandeBouw = (openCommRaw    ?? []).reduce((s, d) => s + Math.max(0, Number(d.commission_amount) - Number(d.commission_received_amount ?? 0)), 0)
  const openstaandeGT   = (gtOpenCommRaw  ?? []).reduce((s, d) => s + Math.max(0, Number(d.commission_amount) - Number(d.commission_received_amount ?? 0)), 0)
  const openstaandeComm = openstaandeBouw + openstaandeGT

  // Bouwcheck — selected month
  const totalDealValue  = deals.reduce((s, d) => s + Number(d.deal_value), 0)
  const totalCommission = deals.reduce((s, d) => s + Number(d.commission_amount), 0)
  const dealCount       = deals.length

  // GreenTeam — selected month
  type GTRow = { deal_value: number; commission_amount: number }
  const gtMonth      = (gtMonthRaw ?? []) as GTRow[]
  const gtMonthValue = gtMonth.reduce((s, d) => s + Number(d.deal_value), 0)
  const gtMonthComm  = gtMonth.reduce((s, d) => s + Number(d.commission_amount), 0)
  const gtMonthCount = gtMonth.length

  // Ad budget + meta
  const totalAdBudget = adBudget.reduce((s, a) => s + Number(a.amount), 0)
  const metaSpendAmt  = Number(metaSpendRow?.amount_eur ?? 0)
  const adPnL         = totalAdBudget - metaSpendAmt

  // Bouwcheck 6-month trend
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
    month: mo, label: NL_MONTHS[parseInt(mo.split('-')[1]) - 1], amount,
  }))

  // GreenTeam 6-month trend
  const gtTrendMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(selYear, selMonth - i, 1)
    gtTrendMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
  }
  for (const d of (gtTrendRaw ?? []) as { commission_amount: number; closed_at: string }[]) {
    const key = d.closed_at.slice(0, 7)
    if (key in gtTrendMap) gtTrendMap[key] += Number(d.commission_amount)
  }
  const gtTrend = Object.entries(gtTrendMap).map(([mo, amount]) => ({
    month: mo, label: NL_MONTHS[parseInt(mo.split('-')[1]) - 1], amount,
  }))

  // YTD — Bouwcheck
  type YtdRow = { deal_value: number; commission_amount: number; contractor_id: string | null }
  const ytdDeals          = (ytdDealsRaw ?? []) as YtdRow[]
  const ytdCount          = ytdDeals.length
  const ytdTotalDealValue = ytdDeals.reduce((s, d) => s + Number(d.deal_value), 0)
  const ytdTotalComm      = ytdDeals.reduce((s, d) => s + Number(d.commission_amount), 0)
  const ytdAvgDealValue   = ytdCount > 0 ? Math.round(ytdTotalDealValue / ytdCount) : 0
  const ytdEmpty          = ytdCount === 0

  const ytdContMap: Record<string, { dealValue: number; commission: number }> = {}
  for (const d of ytdDeals) {
    if (!d.contractor_id) continue
    const e = ytdContMap[d.contractor_id] ?? { dealValue: 0, commission: 0 }
    e.dealValue  += Number(d.deal_value)
    e.commission += Number(d.commission_amount)
    ytdContMap[d.contractor_id] = e
  }
  const ytdByContractor = contractors
    .map(c => ({ id: c.id, name: c.name, niche: c.niche ?? '', ...(ytdContMap[c.id] ?? { dealValue: 0, commission: 0 }) }))
    .filter(c => c.dealValue > 0)
    .sort((a, b) => b.dealValue - a.dealValue)

  // Shared card styles
  const card: React.CSSProperties = {
    padding: '18px 20px', background: 'var(--color-surface)',
    border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)',
  }
  const lbl: React.CSSProperties = {
    fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
  }
  const val: React.CSSProperties = {
    fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums',
  }
  const sub: React.CSSProperties = {
    fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4,
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

      {/* Primaire vergelijking: Bouwcheck vs GreenTeam */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>

        {/* Bouwcheck */}
        <div style={{ ...card, borderTop: '3px solid #4f7df3' }}>
          <div style={lbl}>Bouwcheck — {periodLabel}</div>
          <div style={val}>{totalDealValue > 0 ? fmtEur(totalDealValue) : '—'}</div>
          <div style={sub}>{dealCount} deal{dealCount !== 1 ? 's' : ''} gesloten</div>
          {totalCommission > 0 && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: '#4f7df3', marginTop: 6, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              {fmtEur(totalCommission)} commissie
            </div>
          )}
        </div>

        {/* GreenTeam */}
        <div style={{ ...card, borderTop: '3px solid #3fb950' }}>
          <div style={lbl}>GreenTeam — {periodLabel}</div>
          <div style={val}>{gtMonthValue > 0 ? fmtEur(gtMonthValue) : '—'}</div>
          <div style={sub}>{gtMonthCount} deal{gtMonthCount !== 1 ? 's' : ''} gesloten</div>
          {gtMonthComm > 0 && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: '#3fb950', marginTop: 6, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              {fmtEur(gtMonthComm)} commissie
            </div>
          )}
        </div>

        {/* Totaal omzet */}
        <div style={card}>
          <div style={lbl}>Totaal omzet — {periodLabel}</div>
          <div style={val}>{totalDealValue + gtMonthValue > 0 ? fmtEur(totalDealValue + gtMonthValue) : '—'}</div>
          <div style={sub}>{dealCount + gtMonthCount} deals samen</div>
        </div>

        {/* Totaal commissie */}
        <div style={card}>
          <div style={lbl}>Totaal commissie — {periodLabel}</div>
          <div style={{ ...val, color: totalCommission + gtMonthComm > 0 ? 'var(--color-ink)' : 'var(--color-ink-faint)' }}>
            {totalCommission + gtMonthComm > 0 ? fmtEur(totalCommission + gtMonthComm) : '—'}
          </div>
          <div style={sub}>gecombineerd</div>
        </div>
      </div>

      {/* Ad budget + meta spend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <div style={lbl}>Ad Budget Revenue {periodLabel}</div>
          <div style={val}>{fmtEur(totalAdBudget)}</div>
          <div style={sub}>ontvangen van aannemers</div>
        </div>
        <div style={card}>
          <div style={lbl}>Meta Ad Spend {periodLabel}</div>
          <div style={val}>{fmtEur(metaSpendAmt)}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 4, color: adPnL >= 0 ? '#3fb950' : '#f85149' }}>
            {adPnL >= 0 ? '+' : '−'}{fmtEur(Math.abs(adPnL))} {adPnL >= 0 ? 'surplus' : 'tekort'}
          </div>
        </div>
      </div>

      {/* Openstaande commissie — all-time (bouw + greenteam) */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ padding: '18px 20px', background: 'var(--color-surface)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
              Openstaande commissie
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>All-time — nog niet ontvangen</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {openstaandeBouw > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginBottom: 2 }}>Bouwcheck</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: '#3fb950', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(openstaandeBouw)}</div>
              </div>
            )}
            {openstaandeGT > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginBottom: 2 }}>GreenTeam</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: '#3fb950', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(openstaandeGT)}</div>
              </div>
            )}
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: openstaandeComm > 0 ? '#3fb950' : 'var(--color-ink-faint)', fontVariantNumeric: 'tabular-nums' }}>
              {openstaandeComm > 0 ? fmtEur(openstaandeComm) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* YTD — Bouwcheck */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            YTD {currentYear}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', marginTop: 2 }}>
            1 jan – vandaag · alle niches
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Gemiddelde deal value', value: ytdEmpty ? '—' : fmtEur(ytdAvgDealValue),   sub: 'Gem. per deal' },
            { label: 'Totale omzet',          value: ytdEmpty ? '—' : fmtEur(ytdTotalDealValue), sub: 'Deal waarde YTD' },
            { label: 'Onze commissie',        value: ytdEmpty ? '—' : fmtEur(ytdTotalComm),      sub: 'Commissie YTD' },
            { label: 'Aantal deals',          value: ytdEmpty ? '—' : String(ytdCount),           sub: 'Gesloten dit jaar' },
          ].map(c => (
            <div key={c.label} style={card}>
              <div style={lbl}>{c.label}</div>
              <div style={val}>{c.value}</div>
              <div style={sub}>{c.sub}</div>
            </div>
          ))}
        </div>
        {ytdEmpty && (
          <div style={{ marginTop: 10, fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
            Nog geen deals dit jaar.
          </div>
        )}
      </div>

      {/* Charts */}
      <FinanceCharts
        trend={trend}
        gtTrend={gtTrend}
        ytdByContractor={ytdByContractor}
        selectedMonth={selectedMonthKey}
        periodLabel={periodLabel}
        currentYear={currentYear}
      />
    </div>
  )
}
