import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../lib/supabase-server'

export async function GET(_req: NextRequest) {
  const db = serverClient()
  const { data, error } = await db.from('ad_budget_revenue')
    .select('*, contractor:contractors(name, niche)')
    .order('received_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const db = serverClient()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { contractor_id, amount, received_at, description } = body as {
    contractor_id?: string; amount: number; received_at: string; description?: string
  }

  if (!amount || !received_at) {
    return NextResponse.json({ error: 'amount en received_at zijn verplicht' }, { status: 400 })
  }

  const { data, error } = await db.from('ad_budget_revenue')
    .insert({ contractor_id: contractor_id || null, amount: Number(amount), received_at, description: description || null })
    .select('*, contractor:contractors(name, niche)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
