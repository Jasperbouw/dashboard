import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../../lib/supabase-server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params
  const body = await req.json()

  const db = serverClient()

  const { data, error } = await db
    .from('contractor_documents')
    .update({
      title: body.title ?? undefined,
      notes: body.notes ?? undefined,
    })
    .eq('id', docId)
    .eq('contractor_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params
  const db = serverClient()

  const { error } = await db
    .from('contractor_documents')
    .update({ status: 'archived' })
    .eq('id', docId)
    .eq('contractor_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
