import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json()

  const db = serverClient()
  const { data, error } = await db
    .from('revenue_entries')
    .insert({
      contractor_id:    id,
      entry_date:       body.entry_date,
      period_start:     body.period_start   || null,
      period_end:       body.period_end     || null,
      type:             body.type,
      niche:            body.niche          || null,
      amount:           Number(body.amount),
      ad_budget_amount: Number(body.ad_budget_amount ?? 0),
      description:      body.description    || null,
      invoice_number:   body.invoice_number || null,
      payment_status:   body.payment_status || 'paid',
      paid_at:          body.payment_status === 'paid' ? (body.entry_date + 'T00:00:00Z') : null,
      notes:            body.notes          || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
