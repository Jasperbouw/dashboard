import { serverClient } from '../../../lib/supabase-server'
import { getActiveContractors, ALL_INCOME_TYPES } from '../../../lib/metrics'
import { StatCard } from '../../components/ui/StatCard'
import { FinanceCharts } from '../../components/finance/FinanceCharts'
import { MonthPicker } from '../../components/finance/MonthPicker'

export const dynamic = 'force-dynamic'

const NL_MONTHS = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
const MODEL_LABELS: Record<string, string> = { percentage: 'Percentage', flat_fee: 'Vast bedrag', retainer: 'Retainer' }
const NICHE_LABELS: Record<string, string> = { bouw: 'Bouw', daken: 'Daken', dakkapel: 'Dakkapel', extras: 'Extras', overig: 'Overig' }

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function FinancePage({ searchParams }: Props) {
  const params = await searchParams

  const now          = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth()  // 0-indexed
  const maxMonthKey  = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`

  // Parse ?month=YYYY-MM, clamp to [max-11, max]
  let selYear: number
  let selMonth: number  // 0-indexed

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

  const selectedMonthKey  = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`
  const isCurrentMonth    = selectedMonthKey === maxMonthKey
  const selectedMonthLabel = NL_MONTHS[selMonth]

  // Period boundaries
  const monthStart    = new Date(selYear, selMonth, 1)
  const monthEnd      = new Date(selYear, selMonth + 1, 0)  // last day
  const quarterMonth  = Math.floor(selMonth / 3) * 3
  const quarterStart  = new Date(selYear, quarterMonth, 1)
  const ytdStart      = new Date(selYear, 0, 1)
  const trendStart    = new Date(selYear, selMonth - 5, 1)   // 6 months window
  const dataStart     = trendStart < ytdStart ? trendStart : ytdStart

  const monthStartDate   = monthStart.toISOString().slice(0, 10)
  const monthEndDate     = monthEnd.toISOString().slice(0, 10)
  const quarterStartDate = quarterStart.toISOString().slice(0, 10)
  const ytdStartDate     = ytdStart.toISOString().slice(0, 10)
  const dataStartDate    = dataStart.toISOString().slice(0, 10)

  const db = serverClient()
  const contractors = await getActiveContractors()
  const activeIds     = contractors.map(c => c.id)
  const contractorMap = new Map(contractors.map(c => [c.id, c]))

  type RevRow = { contractor_id: string; amount: number; type: string; niche: string | null; entry_date: string }

  const [{ data: revenueRaw }, { data: pendingProjects }, { data: metaSpendRow }] = await Promise.all([
    db.from('revenue_entries')
      .select('contractor_id, amount, type, niche, entry_date')
      .in('contractor_id', activeIds)
      .eq('payment_status', 'paid')
      .gte('entry_date', dataStartDate)
      .lte('entry_date', monthEndDate),
    db.from('projects')
      .select('contractor_id, commissie')
      .in('contractor_id', activeIds)
      .not('commissie', 'is', null)
      .gt('commissie', 0)
      .not('commissie_status', 'ilike', '%betaald%'),
    db.from('meta_spend_monthly')
      .select('amount_eur')
      .eq('year_month', `${selYear}-${String(selMonth + 1).padStart(2, '0')}-01`)
      .maybeSingle(),
  ])

  const revenue = (revenueRaw ?? []) as RevRow[]
  const pending  = pendingProjects ?? []
  const income   = revenue.filter(e => ALL_INCOME_TYPES.includes(e.type))

  function revSum(fromDate: string, toDate: string, rows = income) {
    return rows
      .filter(e => e.entry_date >= fromDate && e.entry_date <= toDate)
      .reduce((s, e) => s + Number(e.amount), 0)
  }

  const mtd          = revSum(monthStartDate, monthEndDate)
  const qtd          = revSum(quarterStartDate, monthEndDate)
  const ytd          = revSum(ytdStartDate, monthEndDate)
  const pendingTotal = pending.reduce((s, p) => s + (p.commissie ?? 0), 0)

  const adBudgetPeriod = revenue
    .filter(e => e.type === 'ad_budget' && e.entry_date >= monthStartDate && e.entry_date <= monthEndDate)
    .reduce((s, e) => s + Number(e.amount), 0)
  const metaSpendPeriod = Number(metaSpendRow?.amount_eur ?? 0)
  const adPnL           = adBudgetPeriod - metaSpendPeriod

  // Breakdowns for selected month
  const MODEL_ORDER = ['percentage', 'flat_fee', 'retainer'] as const
  const byModelRaw: Record<string, number> = { percentage: 0, flat_fee: 0, retainer: 0 }
  for (const e of income.filter(e => e.entry_date >= monthStartDate && e.entry_date <= monthEndDate)) {
    const model = contractorMap.get(e.contractor_id)?.commission_model ?? 'unknown'
    byModelRaw[model] = (byModelRaw[model] ?? 0) + Number(e.amount)
  }
  const byModel = MODEL_ORDER.map(m => ({
    name: m, label: MODEL_LABELS[m] ?? m, amount: byModelRaw[m] ?? 0,
  }))

  const NICHE_ORDER = ['bouw', 'daken', 'dakkapel', 'extras']
  const byNicheRaw: Record<string, number> = Object.fromEntries(NICHE_ORDER.map(n => [n, 0]))
  for (const e of income.filter(e => e.entry_date >= monthStartDate && e.entry_date <= monthEndDate)) {
    const niche = e.niche ?? contractorMap.get(e.contractor_id)?.niche ?? 'overig'
    byNicheRaw[niche] = (byNicheRaw[niche] ?? 0) + Number(e.amount)
  }
  const byNiche = NICHE_ORDER
    .map(name => ({ name, label: NICHE_LABELS[name] ?? name, amount: byNicheRaw[name] ?? 0 }))

  // Top 5 contractors by selected-month revenue
  const contRevMap: Record<string, number> = {}
  for (const e of income.filter(e => e.entry_date >= monthStartDate && e.entry_date <= monthEndDate)) {
    contRevMap[e.contractor_id] = (contRevMap[e.contractor_id] ?? 0) + Number(e.amount)
  }
  const top5 = contractors
    .map(c => ({ id: c.id, name: c.name, niche: c.niche, model: c.commission_model ?? '', amount: contRevMap[c.id] ?? 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // 6-month trend window ending at selected month
  const trendMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(selYear, selMonth - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    trendMap[key] = 0
  }
  for (const e of income) {
    const key = e.entry_date.slice(0, 7)
    if (key in trendMap) trendMap[key] += Number(e.amount)
  }
  const trend = Object.entries(trendMap).map(([mo, amount]) => ({
    month: mo,
    label: NL_MONTHS[parseInt(mo.split('-')[1]) - 1],
    amount,
  }))

  // Labels
  const periodLabel = `${selectedMonthLabel} ${selYear}`
  const mtdLabel    = isCurrentMonth ? 'Omzet MTD' : `Omzet ${periodLabel}`
  const qtdLabel    = isCurrentMonth ? 'Omzet QTD' : `Q${Math.floor(selMonth / 3) + 1} ${selYear}`
  const ytdMeta     = `Januari – ${selectedMonthLabel} ${selYear}`
  const adLabel     = isCurrentMonth ? 'MTD' : periodLabel

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
            Finance
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
            Commissie en retaineroverzicht
          </p>
        </div>
        <MonthPicker value={selectedMonthKey} max={maxMonthKey} />
      </div>

      {/* 4 hero tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard
          label={mtdLabel}
          value={mtd}
          prefix="€"
          meta="Commissie + retainer · ad budget exclusief"
        />
        <StatCard
          label={qtdLabel}
          value={qtd}
          prefix="€"
          meta={`Q${Math.floor(selMonth / 3) + 1} ${selYear}`}
        />
        <StatCard
          label="Omzet YTD"
          value={ytd}
          prefix="€"
          meta={ytdMeta}
        />
        <StatCard
          label="Commissie pending"
          value={pendingTotal}
          prefix="€"
          subtext={`${pending.length} project${pending.length !== 1 ? 'en' : ''} nog niet ontvangen`}
        />
      </div>

      {/* Ad spend P&L tile */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
      }}>
        {[
          { label: `Ad Budget ontvangen ${adLabel}`, value: adBudgetPeriod, color: 'var(--color-ink)' },
          { label: `Meta spend ${adLabel}`,           value: metaSpendPeriod,  color: 'var(--color-ink)' },
          {
            label: adPnL >= 0 ? `Surplus ${adLabel}` : `Tekort ${adLabel}`,
            value: Math.abs(adPnL),
            color: adPnL >= 0 ? '#3fb950' : '#f85149',
          },
        ].map((item, i) => (
          <div key={i} style={{
            padding: '18px 20px',
            borderRight: i < 2 ? '1px solid var(--color-border-subtle)' : undefined,
          }}>
            <div style={{
              fontSize: 'var(--font-size-2xs)', fontWeight: 600,
              color: 'var(--color-ink-faint)', textTransform: 'uppercase',
              letterSpacing: '0.07em', marginBottom: 6,
            }}>
              {item.label}
            </div>
            <div style={{
              fontSize: 'var(--font-size-2xl)', fontWeight: 600,
              color: item.color, fontVariantNumeric: 'tabular-nums',
            }}>
              {adPnL < 0 && i === 2 ? '−' : ''}€{item.value.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            {i === 2 && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
                Ad budget − Meta spend
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts + tables */}
      <FinanceCharts
        trend={trend}
        byModel={byModel}
        byNiche={byNiche}
        top5={top5}
        ytd={ytd}
        selectedMonth={selectedMonthKey}
        periodLabel={periodLabel}
      />
    </div>
  )
}
