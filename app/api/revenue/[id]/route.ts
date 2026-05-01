import { NextResponse } from 'next/server'

export function GET()    { return NextResponse.json({ error: 'revenue_entries removed' }, { status: 410 }) }
export function PUT()    { return NextResponse.json({ error: 'revenue_entries removed' }, { status: 410 }) }
export function DELETE() { return NextResponse.json({ error: 'revenue_entries removed' }, { status: 410 }) }
