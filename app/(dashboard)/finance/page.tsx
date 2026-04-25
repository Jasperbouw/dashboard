import { serverClient } from '../../../lib/supabase-server'
import { getActiveContractors, ALL_INCOME_TYPES } from '../../../lib/metrics'
import { StatCard } from '../../components/ui/StatCard'
import { FinanceCharts } from '../../components/finance/FinanceCharts'

export const dynamic = 'force-dynamic'

const NL_MONTHS = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
const MODEL_LABELS: Record<string, string> = { percentage: 'Percentage', flat_fee: 'Vast bedrag', retainer: 'Retainer' }
const NICHE_LABELS: Record<string, string> = { bouw: 'Bouw', daken: 'Daken', dakkapel: 'Dakkapel', extras: 'Extras', overig: 'Overig' }

function startOf(unit: 'month' | 'quarter' | 'year'): Date {
  const now = new Date()
  if (unit === 'month')   return new Date(now.getFullYear(), now.getMonth(), 1)
  if (unit === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  return new Date(now.getFullYear(), 0, 1)
}

export default async function FinancePage() {
  const db = serverClient()
  const contractors = await getActiveContractors()
  const activeIds     = contractors.map(c => c.id)
  const contractorMap = new Map(contractors.map(c => [c.id, c]))

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  // Boundaries — ISO timestamp for monday_created_at, date string for invoice_date
  const mtdStart     = startOf('month').toISOString()
  const qtdStart     = startOf('quarter').toISOString()
  const ytdStart     = startOf('year').toISOString()
  // JS Date handles negative months: new Date(2026, -2, 1) → Nov 2025
  const sixMonthsAgo = new Date(year, month - 5, 1).toISOString()

  const mtdDate   = mtdStart.slice(0, 10)
  const qtdDate   = qtdStart.slice(0, 10)
  const ytdDate   = ytdStart.slice(0, 10)
  const sixMoDate = sixMonthsAgo.slice(0, 10)

  type RevRow = { contractor_id: string; amount: number; ad_budget_amount: number; type: string; niche: string | null; entry_date: string }

  const [{ data: revenueRaw }, { data: pendingProjects }] = await Promise.all([
    db.from('revenue_entries')
      .select('contractor_id, amount, ad_budget_amount, type, niche, entry_date')
      .in('contractor_id', activeIds)
      .eq('payment_status', 'paid')
      .gte('entry_date', sixMoDate),
    db.from('projects')
      .select('contractor_id, commissie')
      .in('contractor_id', activeIds)
      .not('commissie', 'is', null)
      .gt('commissie', 0)
      .not('commissie_status', 'ilike', '%betaald%'),
  ])

  const revenue = (revenueRaw ?? []) as RevRow[]
  const pending = pendingProjects ?? []

  // Only income types (excludes ad_budget pass-through) for revenue tiles
  const income = revenue.filter(e => ALL_INCOME_TYPES.includes(e.type))

  function revSum(fromDate: string, rows = income) {
    return rows.filter(e => e.entry_date >= fromDate).reduce((s, e) => s + Number(e.amount), 0)
  }

  const mtd          = revSum(mtdDate)
  const qtd          = revSum(qtdDate)
  const ytd          = revSum(ytdDate)
  const pendingTotal = pending.reduce((s, p) => s + (p.commissie ?? 0), 0)

  // Ad budget pass-through total (shown separately, not counted as our income)
  const adBudgetMTD = revenue.filter(e => e.type === 'ad_budget' && e.entry_date >= mtdDate)
    .reduce((s, e) => s + Number(e.ad_budget_amount), 0)
  const adBudgetYTD = revenue.filter(e => e.type === 'ad_budget' && e.entry_date >= ytdDate)
    .reduce((s, e) => s + Number(e.ad_budget_amount), 0)

  // Revenue by commission model (YTD) — pre-seed all three so €0 rows always appear
  const MODEL_ORDER = ['percentage', 'flat_fee', 'retainer'] as const
  const byModelRaw: Record<string, number> = { percentage: 0, flat_fee: 0, retainer: 0 }
  for (const e of income.filter(e => e.entry_date >= ytdDate)) {
    const model = contractorMap.get(e.contractor_id)?.commission_model ?? 'unknown'
    byModelRaw[model] = (byModelRaw[model] ?? 0) + Number(e.amount)
  }
  const byModel = MODEL_ORDER.map(m => ({
    name: m, label: MODEL_LABELS[m] ?? m, amount: byModelRaw[m] ?? 0,
  }))

  // Revenue by niche (YTD) — use entry's niche if set, else contractor niche
  const NICHE_ORDER = ['bouw', 'daken', 'dakkapel', 'extras']
  const byNicheRaw: Record<string, number> = Object.fromEntries(NICHE_ORDER.map(n => [n, 0]))
  for (const e of income.filter(e => e.entry_date >= ytdDate)) {
    const niche = e.niche ?? contractorMap.get(e.contractor_id)?.niche ?? 'overig'
    byNicheRaw[niche] = (byNicheRaw[niche] ?? 0) + Number(e.amount)
  }
  const byNiche = NICHE_ORDER
    .map(name => ({ name, label: NICHE_LABELS[name] ?? name, amount: byNicheRaw[name] ?? 0 }))

  // Top 5 contractors by YTD revenue
  const contRevMap: Record<string, number> = {}
  for (const e of income.filter(e => e.entry_date >= ytdDate)) {
    contRevMap[e.contractor_id] = (contRevMap[e.contractor_id] ?? 0) + Number(e.amount)
  }
  const top5 = contractors
    .map(c => ({ id: c.id, name: c.name, niche: c.niche, model: c.commission_model ?? '', ytd: contRevMap[c.id] ?? 0 }))
    .sort((a, b) => b.ytd - a.ytd)
    .slice(0, 5)

  // 6-month trend
  const trendMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
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

  const monthLabel = NL_MONTHS[month]

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
          Finance
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
          Commissie en retaineroverzicht · {monthLabel} {year}
        </p>
      </div>

      {/* 4 hero tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard
          label="Omzet MTD"
          value={mtd}
          prefix="€"
          meta="Betaalde commissie + retainerfee deze maand"
        />
        <StatCard
          label="Omzet QTD"
          value={qtd}
          prefix="€"
          meta="Dit kwartaal"
        />
        <StatCard
          label="Omzet YTD"
          value={ytd}
          prefix="€"
          meta={`Januari – ${monthLabel} ${year}`}
        />
        <StatCard
          label="Commissie pending"
          value={pendingTotal}
          prefix="€"
          subtext={`${pending.length} project${pending.length !== 1 ? 'en' : ''} nog niet ontvangen`}
        />
      </div>

      {/* Charts + tables */}
      <FinanceCharts
        trend={trend}
        byModel={byModel}
        byNiche={byNiche}
        top5={top5}
        adBudgetMTD={adBudgetMTD}
        adBudgetYTD={adBudgetYTD}
        netMTD={mtd}
        ytd={ytd}
      />
    </div>
  )
}
