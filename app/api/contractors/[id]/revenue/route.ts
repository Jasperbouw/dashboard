import { NextResponse } from 'next/server'

export function POST() { return NextResponse.json({ error: 'revenue_entries removed — use /api/deals/closed' }, { status: 410 }) }
