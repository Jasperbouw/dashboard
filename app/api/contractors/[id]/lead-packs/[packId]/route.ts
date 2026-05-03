import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../../lib/supabase-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
  const { id: contractorId, packId } = await params
  const body = await req.json()

  // Only allow safe fields to be updated
  const allowed = ['units_used', 'status', 'notes', 'completed_at', 'amount_paid',
                   'niche', 'pack_type', 'units_promised', 'started_at']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Auto-set completed_at when marking as completed
  if (update.status === 'completed' && !update.completed_at) {
    update.completed_at = new Date().toISOString()
  }

  const db = serverClient()

  const { data, error } = await db
    .from('lead_packs')
    .update(update)
    .eq('id', packId)
    .eq('contractor_id', contractorId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
  const { id: contractorId, packId } = await params
  const db = serverClient()

  // Soft delete via status = paused, or hard delete if you prefer
  const { error } = await db
    .from('lead_packs')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', packId)
    .eq('contractor_id', contractorId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
