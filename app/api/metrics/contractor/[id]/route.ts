import { NextResponse } from 'next/server'
import {
  getContractor,
  leadsReceived, qualifiedLeads, qualificationRate,
  inspectionsBooked, quotesSent, quotesWon, closeRate,
  avgDealSize, avgDaysToQuote, avgDaysQuoteToClose,
  pipelineValue, commissionBooked, commissionPending, overdueFollowUps,
  currentMonth, previousPeriod,
} from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const range = {
      from: searchParams.get('from') ? new Date(searchParams.get('from')!) : currentMonth().from,
      to:   searchParams.get('to')   ? new Date(searchParams.get('to')!)   : currentMonth().to,
    }
    const prev = previousPeriod(range)

    const contractor = await getContractor(id)
    if (!contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })

    const [
      leadsNow,  leadsPrev,
      qualNow,   qualPrev,
      qrNow,     qrPrev,
      inspNow,   inspPrev,
      sentNow,   sentPrev,
      wonNow,    wonPrev,
      crNow,     crPrev,
      dealNow,   dealPrev,
      daysQuote, daysClose,
      pipe, commB, commP, overdue,
    ] = await Promise.all([
      leadsReceived(id, range),    leadsReceived(id, prev),
      qualifiedLeads(id, range),   qualifiedLeads(id, prev),
      qualificationRate(id, range), qualificationRate(id, prev),
      inspectionsBooked(id, range), inspectionsBooked(id, prev),
      quotesSent(id, range),       quotesSent(id, prev),
      quotesWon(id, range),        quotesWon(id, prev),
      closeRate(id, range),        closeRate(id, prev),
      avgDealSize(id, range),      avgDealSize(id, prev),
      avgDaysToQuote(id, range),
      avgDaysQuoteToClose(id, range),
      pipelineValue(id),
      commissionBooked(id, range),
      commissionPending(id),
      overdueFollowUps(id),
    ])

    const t = (v: number | null, p: number | null) => ({
      value: v,
      previousPeriodValue: p,
      trend: (v != null && p != null && p !== 0)
        ? Math.round(((v - p) / p) * 1000) / 10
        : null,
    })

    return NextResponse.json({
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      contractor: {
        id: contractor.id,
        name: contractor.name,
        niche: contractor.niche,
        commission_model: contractor.commission_model,
        commission_rate: contractor.commission_rate,
        qualification_model: contractor.qualification_model,
        target_monthly_leads: contractor.target_monthly_leads,
        target_monthly_deals: contractor.target_monthly_deals,
        target_monthly_revenue: contractor.target_monthly_revenue,
        target_commission: contractor.target_commission,
      },
      metrics: {
        leadsReceived:        t(leadsNow, leadsPrev),
        qualifiedLeads:       t(qualNow, qualPrev),
        qualificationRate:    t(qrNow, qrPrev),
        inspectionsBooked:    t(inspNow, inspPrev),
        quotesSent:           t(sentNow, sentPrev),
        quotesWon:            t(wonNow, wonPrev),
        closeRate:            t(crNow, crPrev),
        avgDealSize:          t(dealNow, dealPrev),
        avgDaysToQuote:       { value: daysQuote },
        avgDaysQuoteToClose:  { value: daysClose },
        pipelineValue:        { value: pipe },
        commissionBooked:     { value: commB },
        commissionPending:    { value: commP },
        overdueFollowUps:     { value: overdue },
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
