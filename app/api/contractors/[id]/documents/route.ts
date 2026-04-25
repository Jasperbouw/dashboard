import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
])
const MAX_BYTES = 10 * 1024 * 1024

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const { data, error } = await db
    .from('contractor_documents')
    .select('*')
    .eq('contractor_id', id)
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const docs = await Promise.all(
    (data ?? []).map(async doc => {
      const { data: urlData } = await db.storage
        .from('contractor-documents')
        .createSignedUrl(doc.file_path, 3600)
      return { ...doc, download_url: urlData?.signedUrl ?? null }
    }),
  )

  return NextResponse.json(docs)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file          = formData.get('file') as File | null
  const document_type = (formData.get('document_type') as string) || 'other'
  const title         = (formData.get('title') as string) || ''
  const notes         = (formData.get('notes') as string) || null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Bestandstype niet toegestaan (PDF, DOCX, DOC, JPG, PNG)' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Bestand te groot (max 10 MB)' }, { status: 400 })
  }

  const ts      = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `contractors/${id}/documents/${document_type}/${ts}-${safeName}`

  const bytes = await file.arrayBuffer()
  const { error: storageError } = await db.storage
    .from('contractor-documents')
    .upload(filePath, Buffer.from(bytes), { contentType: file.type, upsert: false })

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  // Archive existing active contract_signed before inserting new one
  let supersedesId: string | null = null
  if (document_type === 'contract_signed') {
    const { data: existing } = await db
      .from('contractor_documents')
      .select('id')
      .eq('contractor_id', id)
      .eq('document_type', 'contract_signed')
      .eq('status', 'active')
      .maybeSingle()

    if (existing) {
      supersedesId = existing.id
      await db
        .from('contractor_documents')
        .update({ status: 'archived' })
        .eq('id', existing.id)
    }
  }

  const { data, error } = await db
    .from('contractor_documents')
    .insert({
      contractor_id:    id,
      document_type,
      title:            title || file.name,
      file_path:        filePath,
      file_size_bytes:  file.size,
      mime_type:        file.type,
      notes:            notes || null,
      status:           'active',
      supersedes_id:    supersedesId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
