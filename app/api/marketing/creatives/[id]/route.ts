import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status, rejection_reason, rejection_notes } = body as {
    status: 'published' | 'rejected' | 'pending'
    rejection_reason?: string
    rejection_notes?:  string
  }

  if (!['published', 'rejected', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'status must be published, rejected, or pending' }, { status: 400 })
  }

  if (status === 'rejected' && !rejection_reason) {
    return NextResponse.json({ error: 'rejection_reason is required when rejecting' }, { status: 400 })
  }

  const update: Record<string, unknown> = { status }

  if (status === 'rejected') {
    update.rejection_reason = rejection_reason ?? null
    update.rejection_notes  = rejection_notes  ?? null
    update.reviewed_at      = new Date().toISOString()
  } else if (status === 'published') {
    update.rejection_reason = null
    update.rejection_notes  = null
    update.reviewed_at      = new Date().toISOString()
  } else {
    // pending = revert to unreviewed
    update.rejection_reason = null
    update.rejection_notes  = null
    update.reviewed_at      = null
  }

  const { data, error } = await serverClient()
    .from('creatives')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
