import { NextResponse } from 'next/server'
import { todayBundle } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await todayBundle()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
