import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'

const BUCKET = 'dashboard-documents'

const INLINE_TYPES = new Set(['application/pdf'])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const { data: doc } = await db
    .from('documents')
    .select('storage_path, filename, mime_type')
    .eq('id', id)
    .single()

  if (!doc) return new NextResponse('Not found', { status: 404 })

  const { data: blob, error } = await db.storage
    .from(BUCKET)
    .download(doc.storage_path)

  if (error || !blob) return new NextResponse('Storage error', { status: 500 })

  const contentType  = doc.mime_type ?? 'application/octet-stream'
  const disposition  = INLINE_TYPES.has(contentType)
    ? 'inline'
    : `attachment; filename="${doc.filename}"`

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type':        contentType,
      'Content-Disposition': disposition,
      'Cache-Control':       'private, no-store',
    },
  })
}
