import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

const BUCKET = 'dashboard-documents'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const { data: doc } = await db
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (!doc) return new NextResponse('Not found', { status: 404 })

  await db.storage.from(BUCKET).remove([doc.storage_path])

  const { error } = await db.from('documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
