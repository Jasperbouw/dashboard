import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../lib/supabase-server'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_BYTES = 50 * 1024 * 1024  // 50 MB
const BUCKET    = 'dashboard-documents'

export async function GET(_req: NextRequest) {
  const db = serverClient()
  const { data, error } = await db
    .from('documents')
    .select('*')
    .order('month',       { ascending: false })
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const db = serverClient()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file     = formData.get('file')     as File   | null
  const month    = formData.get('month')    as string | null
  const title    = formData.get('title')    as string | null
  const category = formData.get('category') as string | null

  if (!file)  return NextResponse.json({ error: 'Geen bestand meegestuurd' },          { status: 400 })
  if (!month || !/^\d{4}-\d{2}$/.test(month))
              return NextResponse.json({ error: 'Ongeldige maand (verwacht YYYY-MM)' }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type))
              return NextResponse.json({ error: 'Alleen PDF, DOC en DOCX toegestaan' }, { status: 400 })
  if (file.size > MAX_BYTES)
              return NextResponse.json({ error: 'Bestand te groot (max 50 MB)' },       { status: 400 })

  const uuid     = crypto.randomUUID()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${month}/${uuid}-${safeName}`

  const bytes = await file.arrayBuffer()
  const { error: storageError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(bytes), { contentType: file.type, upsert: false })

  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })

  const { data, error: dbError } = await db
    .from('documents')
    .insert({
      filename:        file.name,
      storage_path:    storagePath,
      file_size_bytes: file.size,
      mime_type:       file.type,
      month,
      category:        category || 'algemeen',
      title:           title || null,
    })
    .select()
    .single()

  if (dbError) {
    await db.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
