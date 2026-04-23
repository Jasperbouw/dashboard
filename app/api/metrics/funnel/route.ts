import { NextResponse } from 'next/server'
import { funnelStageDistribution, funnelTransitions, currentMonth } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = {
      from: searchParams.get('from') ? new Date(searchParams.get('from')!) : currentMonth().from,
      to:   searchParams.get('to')   ? new Date(searchParams.get('to')!)   : currentMonth().to,
    }

    const [distribution, transitions] = await Promise.all([
      funnelStageDistribution(range),
      funnelTransitions(range),
    ])

    return NextResponse.json({
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      // Snapshot: where leads currently sit (stacked bar use-case)
      stageDistribution: distribution,
      // Transition-based: how many leads REACHED each stage in range (true funnel)
      transitions: {
        stageCounts:     transitions.stageCounts,
        conversionRates: transitions.conversionRates,
        daysOfData:      transitions.daysOfData != null
          ? Math.round(transitions.daysOfData * 10) / 10
          : null,
        reliable: transitions.reliable,
        note: transitions.reliable
          ? null
          : `Funnel conversion rates become reliable after 14 days of status change history. Current data: ${transitions.daysOfData != null ? Math.round(transitions.daysOfData) + ' days' : 'none yet'}.`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
