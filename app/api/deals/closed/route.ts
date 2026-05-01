import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month       = searchParams.get('month')       // YYYY-MM
  const contractorId = searchParams.get('contractor_id')

  const db = serverClient()
  let q = db.from('closed_deals')
    .select('*, contractor:contractors(name, niche)')
    .order('closed_at', { ascending: false })

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    q = q.gte('closed_at', `${month}-01`).lte('closed_at', `${month}-31`)
  }
  if (contractorId) q = q.eq('contractor_id', contractorId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const db = serverClient()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { client_name, contractor_id, niche, deal_value, commission_amount, closed_at, description } = body as {
    client_name: string; contractor_id?: string; niche?: string
    deal_value: number; commission_amount: number; closed_at: string; description?: string
  }

  if (!client_name || !deal_value || !commission_amount || !closed_at) {
    return NextResponse.json({ error: 'client_name, deal_value, commission_amount en closed_at zijn verplicht' }, { status: 400 })
  }

  const { data, error } = await db.from('closed_deals')
    .insert({ client_name, contractor_id: contractor_id || null, niche: niche || null, deal_value: Number(deal_value), commission_amount: Number(commission_amount), closed_at, description: description || null })
    .select('*, contractor:contractors(name, niche)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
