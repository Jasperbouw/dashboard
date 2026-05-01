import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../../lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> },
) {
  const { id, contractId } = await params
  const db = serverClient()

  const { data: contract } = await db
    .from('contractor_contracts')
    .select('file_path')
    .eq('id', contractId)
    .eq('contractor_id', id)
    .single()

  if (!contract) return new NextResponse('Not found', { status: 404 })

  const { data: blob, error } = await db.storage
    .from('contractor-documents')
    .download(contract.file_path)

  if (error || !blob) return new NextResponse('Storage error', { status: 500 })

  const html = await blob.text()

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> },
) {
  const { id, contractId } = await params
  const db = serverClient()

  const { error } = await db
    .from('contractor_contracts')
    .update({ status: 'archived' })
    .eq('id', contractId)
    .eq('contractor_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
