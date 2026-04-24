import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'
import { getActiveContractors } from '../../../../../lib/metrics'

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

  const [contractors, { data: projects }] = await Promise.all([
    getActiveContractors(),
    db.from('projects')
      .select('project_name, aanneemsom, commissie, commissie_status, betaal_status, monday_created_at')
      .eq('contractor_id', id)
      .order('monday_created_at', { ascending: false }),
  ])

  const contractor = contractors.find(c => c.id === id)
  if (!contractor) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const all = projects ?? []

  // Period helpers
  const mtdStart = startOf('month').toISOString()
  const qtdStart = startOf('quarter').toISOString()
  const ytdStart = startOf('year').toISOString()

  function sumPaid(from: string) {
    return all
      .filter(p => isPaid(p.commissie_status) && p.monday_created_at >= from)
      .reduce((s, p) => s + (p.commissie ?? 0), 0)
  }

  const pending = all.filter(p => (p.commissie ?? 0) > 0 && !isPaid(p.commissie_status))
  const pendingTotal = pending.reduce((s, p) => s + (p.commissie ?? 0), 0)

  // Recent entries — last 10 with any commission value
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

  // Retainer fee = our revenue only, sourced from actual invoices sent.
  // monthly_ad_budget is pass-through to Meta — never counted as revenue.
  let retainerFeeMTD: number | null = null
  let retainerFeeQTD: number | null = null
  let retainerFeeYTD: number | null = null
  if (contractor.commission_model === 'retainer') {
    const now = new Date()
    const year = now.getFullYear()
    const mtdFirst = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const qtdFirst = (() => {
      const q = Math.floor(now.getMonth() / 3) * 3
      return `${year}-${String(q + 1).padStart(2, '0')}-01`
    })()
    const ytdFirst = `${year}-01-01`

    const { data: invoices } = await db
      .from('retainer_invoices')
      .select('invoice_date, fee_amount')
      .eq('contractor_id', id)
      .gte('invoice_date', ytdFirst)

    const inv = invoices ?? []
    const sumFee = (from: string) =>
      inv.filter(i => i.invoice_date >= from).reduce((s, i) => s + Number(i.fee_amount), 0)

    retainerFeeMTD = sumFee(mtdFirst)
    retainerFeeQTD = sumFee(qtdFirst)
    retainerFeeYTD = sumFee(ytdFirst)
  }

  return NextResponse.json({
    commission_model:     contractor.commission_model,
    retainer_billing:     contractor.retainer_billing,
    monthly_retainer_fee: contractor.monthly_retainer_fee,
    monthly_ad_budget:    contractor.monthly_ad_budget,
    relationship_status:  contractor.relationship_status,
    commissionMTD:     sumPaid(mtdStart),
    commissionQTD:     sumPaid(qtdStart),
    commissionYTD:     sumPaid(ytdStart),
    commissionPending: pendingTotal,
    pendingCount:      pending.length,
    retainerFeeMTD,
    retainerFeeQTD,
    retainerFeeYTD,
    recent,
  })
}
