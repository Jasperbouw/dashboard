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

  const { status, rejection_reason } = body as {
    status: 'published' | 'rejected'; rejection_reason?: string
  }

  if (!['published', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be published or rejected' }, { status: 400 })
  }

  const { data, error } = await serverClient()
    .from('creatives')
    .update({
      status,
      rejection_reason: status === 'rejected' ? (rejection_reason ?? null) : null,
      reviewed_at:      new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
