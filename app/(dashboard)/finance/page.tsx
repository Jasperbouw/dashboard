import { serverClient } from '../../../lib/supabase-server'
import { getActiveContractors } from '../../../lib/metrics'
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
  const activeIds   = contractors.map(c => c.id)
  const retainerIds = contractors.filter(c => c.commission_model === 'retainer').map(c => c.id)
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

  type InvoiceRow = { contractor_id: string; fee_amount: number; ad_budget_amount: number; invoice_date: string }

  const [{ data: paidProjects }, { data: pendingProjects }, invoiceResult] = await Promise.all([
    db.from('projects')
      .select('contractor_id, commissie, monday_created_at')
      .in('contractor_id', activeIds)
      .ilike('commissie_status', '%betaald%')
      .gte('monday_created_at', sixMonthsAgo),
    db.from('projects')
      .select('contractor_id, commissie')
      .in('contractor_id', activeIds)
      .not('commissie', 'is', null)
      .gt('commissie', 0)
      .not('commissie_status', 'ilike', '%betaald%'),
    retainerIds.length > 0
      ? db.from('retainer_invoices')
          .select('contractor_id, fee_amount, ad_budget_amount, invoice_date')
          .in('contractor_id', retainerIds)
          .gte('invoice_date', sixMoDate)
      : Promise.resolve({ data: [] as InvoiceRow[] }),
  ])

  const paid     = paidProjects ?? []
  const pending  = pendingProjects ?? []
  const invoices = ((invoiceResult as { data: InvoiceRow[] | null }).data ?? [])

  // Period-sum helpers
  function projSum(from: string) {
    return paid.filter(p => p.monday_created_at >= from).reduce((s, p) => s + (p.commissie ?? 0), 0)
  }
  function invSum(fromDate: string) {
    return invoices.filter(i => i.invoice_date >= fromDate).reduce((s, i) => s + Number(i.fee_amount), 0)
  }

  const mtd          = projSum(mtdStart) + invSum(mtdDate)
  const qtd          = projSum(qtdStart) + invSum(qtdDate)
  const ytd          = projSum(ytdStart) + invSum(ytdDate)
  const pendingTotal = pending.reduce((s, p) => s + (p.commissie ?? 0), 0)

  // Ad budget pass-through (not our revenue)
  function adSum(fromDate: string) {
    return invoices.filter(i => i.invoice_date >= fromDate).reduce((s, i) => s + Number(i.ad_budget_amount), 0)
  }
  const adBudgetMTD = adSum(mtdDate)
  const adBudgetYTD = adSum(ytdDate)

  // Revenue by commission model (YTD) — pre-seed all three so €0 rows always appear
  const MODEL_ORDER = ['percentage', 'flat_fee', 'retainer'] as const
  const byModelRaw: Record<string, number> = { percentage: 0, flat_fee: 0, retainer: 0 }
  for (const p of paid.filter(p => p.monday_created_at >= ytdStart)) {
    const model = contractorMap.get(p.contractor_id)?.commission_model ?? 'unknown'
    byModelRaw[model] = (byModelRaw[model] ?? 0) + (p.commissie ?? 0)
  }
  for (const i of invoices.filter(i => i.invoice_date >= ytdDate)) {
    byModelRaw['retainer'] = (byModelRaw['retainer'] ?? 0) + Number(i.fee_amount)
  }
  const byModel = MODEL_ORDER.map(m => ({
    name: m, label: MODEL_LABELS[m] ?? m, amount: byModelRaw[m] ?? 0,
  }))

  // Revenue by niche (YTD) — pre-seed all active niches so €0 rows always appear
  const NICHE_ORDER = ['bouw', 'daken', 'dakkapel', 'extras']
  const byNicheRaw: Record<string, number> = Object.fromEntries(NICHE_ORDER.map(n => [n, 0]))
  for (const p of paid.filter(p => p.monday_created_at >= ytdStart)) {
    const niche = contractorMap.get(p.contractor_id)?.niche ?? 'overig'
    byNicheRaw[niche] = (byNicheRaw[niche] ?? 0) + (p.commissie ?? 0)
  }
  for (const i of invoices.filter(i => i.invoice_date >= ytdDate)) {
    const niche = contractorMap.get(i.contractor_id)?.niche ?? 'overig'
    byNicheRaw[niche] = (byNicheRaw[niche] ?? 0) + Number(i.fee_amount)
  }
  const byNiche = NICHE_ORDER
    .map(name => ({ name, label: NICHE_LABELS[name] ?? name, amount: byNicheRaw[name] ?? 0 }))

  // Top 5 contractors by YTD revenue — include all active contractors so €0 rows appear
  const contRevMap: Record<string, number> = {}
  for (const p of paid.filter(p => p.monday_created_at >= ytdStart)) {
    contRevMap[p.contractor_id] = (contRevMap[p.contractor_id] ?? 0) + (p.commissie ?? 0)
  }
  for (const i of invoices.filter(i => i.invoice_date >= ytdDate)) {
    contRevMap[i.contractor_id] = (contRevMap[i.contractor_id] ?? 0) + Number(i.fee_amount)
  }
  const top5 = contractors
    .map(c => ({ id: c.id, name: c.name, niche: c.niche, model: c.commission_model ?? '', ytd: contRevMap[c.id] ?? 0 }))
    .sort((a, b) => b.ytd - a.ytd)
    .slice(0, 5)

  // 6-month trend — initialise every bucket so empty months show as 0
  const trendMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    trendMap[key] = 0
  }
  for (const p of paid) {
    const key = (p.monday_created_at as string).slice(0, 7)
    if (key in trendMap) trendMap[key] += p.commissie ?? 0
  }
  for (const i of invoices) {
    const key = i.invoice_date.slice(0, 7)
    if (key in trendMap) trendMap[key] += Number(i.fee_amount)
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
