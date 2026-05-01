import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'
import { getActiveContractors } from '../../../../../lib/metrics'

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

  const [contractors, { data: projects }, { data: dealsRaw }] = await Promise.all([
    getActiveContractors(),
    db.from('projects')
      .select('project_name, aanneemsom, commissie, commissie_status, betaal_status, monday_created_at')
      .eq('contractor_id', id)
      .order('monday_created_at', { ascending: false }),
    db.from('closed_deals')
      .select('commission_amount, deal_value, closed_at, client_name, description')
      .eq('contractor_id', id)
      .gte('closed_at', ytdFirst)
      .order('closed_at', { ascending: false }),
  ])

  const contractor = contractors.find(c => c.id === id)
  if (!contractor) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const all   = projects ?? []
  const deals = (dealsRaw ?? []) as { commission_amount: number; deal_value: number; closed_at: string; client_name: string; description: string | null }[]

  function dealCommSum(from: string) {
    return deals.filter(d => d.closed_at >= from).reduce((s, d) => s + Number(d.commission_amount), 0)
  }

  const commissionMTD = dealCommSum(mtdFirst)
  const commissionQTD = dealCommSum(qtdFirst)
  const commissionYTD = dealCommSum(ytdFirst)

  const isRetainer = contractor.commission_model === 'retainer'

  // Commission pending still from projects
  const pending      = all.filter(p => (p.commissie ?? 0) > 0 && !isPaid(p.commissie_status))
  const pendingTotal = pending.reduce((s, p) => s + (p.commissie ?? 0), 0)

  // Recent deals (top 10 this year)
  const recent = deals.slice(0, 10).map(d => ({
    project_name:     d.client_name,
    aanneemsom:       d.deal_value,
    commissie:        d.commission_amount,
    commissie_status: 'closed',
    date:             d.closed_at,
  }))

  return NextResponse.json({
    commission_model:     contractor.commission_model,
    retainer_billing:     contractor.retainer_billing,
    monthly_retainer_fee: contractor.monthly_retainer_fee,
    monthly_ad_budget:    contractor.monthly_ad_budget,
    relationship_status:  contractor.relationship_status,
    commissionMTD,
    commissionQTD,
    commissionYTD,
    commissionPending: pendingTotal,
    pendingCount:      pending.length,
    retainerFeeMTD:    isRetainer ? commissionMTD : null,
    retainerFeeQTD:    isRetainer ? commissionQTD : null,
    retainerFeeYTD:    isRetainer ? commissionYTD : null,
    recent,
  })
}
