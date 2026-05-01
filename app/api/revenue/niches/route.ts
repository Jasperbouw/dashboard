import { NextResponse } from 'next/server'

export function GET()  { return NextResponse.json([]) }
export function POST() { return NextResponse.json({ error: 'revenue_niches removed' }, { status: 410 }) }
