import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body   = await req.json()
  const db     = serverClient()

  const { data, error } = await db
    .from('revenue_entries')
    .update({
      // Allow explicitly setting contractor_id to null (legacy entries)
      ...(Object.prototype.hasOwnProperty.call(body, 'contractor_id')
        ? { contractor_id: body.contractor_id || null }
        : {}),
      entry_date:     body.entry_date     ?? undefined,
      period_start:   body.period_start   ?? undefined,
      period_end:     body.period_end     ?? undefined,
      type:           body.type           ?? undefined,
      niche:          body.niche          ?? undefined,
      amount:         body.amount != null ? Number(body.amount) : undefined,
      description:    body.description    ?? undefined,
      invoice_number: body.invoice_number ?? undefined,
      payment_status: body.payment_status ?? undefined,
      paid_at:        body.payment_status === 'paid' && body.entry_date
                        ? (body.entry_date + 'T00:00:00Z')
                        : body.payment_status === 'open' ? null : undefined,
      notes:          body.notes          ?? undefined,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, contractor:contractors(name, niche)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db     = serverClient()

  const { error } = await db.from('revenue_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
