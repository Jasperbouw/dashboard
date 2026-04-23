import { NextResponse } from 'next/server'
import { financeSummary, currentMonth } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = {
      from: searchParams.get('from') ? new Date(searchParams.get('from')!) : currentMonth().from,
      to:   searchParams.get('to')   ? new Date(searchParams.get('to')!)   : currentMonth().to,
    }

    const summary = await financeSummary(range)
    return NextResponse.json({
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      ...summary,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
