import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const contractor_id = searchParams.get('contractor_id') || ''
  const type          = searchParams.get('type') || ''
  const niche         = searchParams.get('niche') || ''
  const from_date     = searchParams.get('from_date') || ''
  const to_date       = searchParams.get('to_date') || ''

  const db = serverClient()

  let q = db
    .from('revenue_entries')
    .select('*, contractor:contractors(name, niche)')
    .order('entry_date', { ascending: false })
    .limit(500)

  if (contractor_id) q = q.eq('contractor_id', contractor_id)
  if (type)          q = q.eq('type', type)
  if (niche)         q = q.eq('niche', niche)
  if (from_date)     q = q.gte('entry_date', from_date)
  if (to_date)       q = q.lte('entry_date', to_date)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db   = serverClient()

  const { data, error } = await db
    .from('revenue_entries')
    .insert({
      contractor_id:  body.contractor_id || null,
      entry_date:     body.entry_date,
      period_start:   body.period_start   || null,
      period_end:     body.period_end     || null,
      type:           body.type,
      niche:          body.niche          || null,
      amount:         Number(body.amount),
      description:    body.description    || null,
      invoice_number: body.invoice_number || null,
      payment_status: body.payment_status || 'paid',
      paid_at:        body.payment_status === 'paid'
                        ? (body.entry_date + 'T00:00:00Z')
                        : null,
      linked_project_id: body.linked_project_id || null,
      notes:          body.notes          || null,
    })
    .select('*, contractor:contractors(name, niche)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
