import { NextResponse } from 'next/server'
import { contractorLeaderboard, currentMonth } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = {
      from: searchParams.get('from') ? new Date(searchParams.get('from')!) : currentMonth().from,
      to:   searchParams.get('to')   ? new Date(searchParams.get('to')!)   : currentMonth().to,
    }

    const leaderboard = await contractorLeaderboard(range)
    return NextResponse.json({
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      contractors: leaderboard,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
