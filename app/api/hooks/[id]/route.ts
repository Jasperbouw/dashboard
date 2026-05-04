import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, niche, description, visual_concept, status } = body as {
    name?: string; niche?: string; description?: string
    visual_concept?: string | null; status?: string
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name        !== undefined) patch.name           = name?.trim()
  if (niche       !== undefined) patch.niche          = niche
  if (description !== undefined) patch.description    = description?.trim()
  if ('visual_concept' in body)  patch.visual_concept = visual_concept?.trim() || null
  if (status      !== undefined) patch.status         = status

  const { data, error } = await serverClient()
    .from('hooks')
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
  const { error } = await serverClient().from('hooks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
