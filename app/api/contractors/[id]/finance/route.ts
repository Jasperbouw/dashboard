import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'
import { getActiveContractors, INCOME_TYPES_BY_MODEL, ALL_INCOME_TYPES } from '../../../../../lib/metrics'

function startOf(unit: 'month' | 'quarter' | 'year'): Date {
  const now = new Date()
  if (unit === 'month')   return new Date(now.getFullYear(), now.getMonth(), 1)
  if (unit === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  return new Date(now.getFullYear(), 0, 1)
}

function isPaid(status: string | null): boolean {
  return !!status?.toLowerCase().includes('betaald')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const now      = new Date()
  const year     = now.getFullYear()
  const ytdFirst = `${year}-01-01`
  const mtdFirst = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const qtdFirst = (() => {
    const q = Math.floor(now.getMonth() / 3) * 3
    return `${year}-${String(q + 1).padStart(2, '0')}-01`
  })()

  const [contractors, { data: projects }, { data: revenueRaw }] = await Promise.all([
    getActiveContractors(),
    db.from('projects')
      .select('project_name, aanneemsom, commissie, commissie_status, betaal_status, monday_created_at')
      .eq('contractor_id', id)
      .order('monday_created_at', { ascending: false }),
    db.from('revenue_entries')
      .select('type, amount, ad_budget_amount, entry_date')
      .eq('contractor_id', id)
      .eq('payment_status', 'paid')
      .gte('entry_date', ytdFirst),
  ])

  const contractor = contractors.find(c => c.id === id)
  if (!contractor) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const all     = projects ?? []
  const revenue = (revenueRaw ?? []) as { type: string; amount: number; ad_budget_amount: number; entry_date: string }[]

  // Revenue from revenue_entries — includes all paid income types
  const incomeTypes = INCOME_TYPES_BY_MODEL[contractor.commission_model ?? ''] ?? ALL_INCOME_TYPES
  function revSum(from: string, types: string[] = incomeTypes) {
    return revenue.filter(e => e.entry_date >= from && types.includes(e.type))
      .reduce((s, e) => s + Number(e.amount), 0)
  }

  // Commission pending still comes from projects (deal-level tracking)
  const pending      = all.filter(p => (p.commissie ?? 0) > 0 && !isPaid(p.commissie_status))
  const pendingTotal = pending.reduce((s, p) => s + (p.commissie ?? 0), 0)

  // Recent projects (for deals table — period/flat_fee contractors)
  const recent = all
    .filter(p => (p.commissie ?? 0) > 0 || (p.aanneemsom ?? 0) > 0)
    .slice(0, 10)
    .map(p => ({
      project_name:     p.project_name,
      aanneemsom:       p.aanneemsom,
      commissie:        p.commissie,
      commissie_status: p.commissie_status,
      date:             p.monday_created_at,
    }))

  const isRetainer = contractor.commission_model === 'retainer'

  // For retainer tab: fee-only rows (excluding pass-through ad_budget entries)
  const retainerFeeMTD = isRetainer ? revSum(mtdFirst, ['retainer_fee']) : null
  const retainerFeeQTD = isRetainer ? revSum(qtdFirst, ['retainer_fee']) : null
  const retainerFeeYTD = isRetainer ? revSum(ytdFirst, ['retainer_fee']) : null

  // For percentage/flat tab: commission entries
  const commissionMTD = isRetainer ? 0 : revSum(mtdFirst)
  const commissionQTD = isRetainer ? 0 : revSum(qtdFirst)
  const commissionYTD = isRetainer ? 0 : revSum(ytdFirst)

  return NextResponse.json({
    commission_model:     contractor.commission_model,
    retainer_billing:     contractor.retainer_billing,
    monthly_retainer_fee: contractor.monthly_retainer_fee,
    monthly_ad_budget:    contractor.monthly_ad_budget,
    relationship_status:  contractor.relationship_status,
    commissionMTD:     commissionMTD,
    commissionQTD:     commissionQTD,
    commissionYTD:     commissionYTD,
    commissionPending: pendingTotal,
    pendingCount:      pending.length,
    retainerFeeMTD,
    retainerFeeQTD,
    retainerFeeYTD,
    recent,
  })
}
