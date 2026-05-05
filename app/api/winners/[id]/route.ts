import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const allowed = ['overlay_text', 'notes', 'spend', 'impressions', 'ctr', 'cpl', 'leads']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key] === '' ? null : body[key]
  }

  const { data, error } = await serverClient()
    .from('winners')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const { data: winner } = await db.from('winners').select('image_url').eq('id', id).single()
  if (winner?.image_url) {
    // Extract storage path from public URL
    const url  = new URL(winner.image_url)
    const path = url.pathname.replace(/^\/storage\/v1\/object\/public\/winner-uploads\//, '')
    if (path) await db.storage.from('winner-uploads').remove([path])
  }

  const { error } = await db.from('winners').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
