import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../lib/supabase-server'

export const CPL_WINNER_THRESHOLD = 12

export async function GET(req: NextRequest) {
  const niche = req.nextUrl.searchParams.get('niche')
  let q = serverClient().from('winners').select('*').order('uploaded_at', { ascending: false })
  if (niche) q = q.eq('niche', niche)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const db = serverClient()

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file    = formData.get('image') as File | null
  const niche   = formData.get('niche') as string | null
  const overlay = formData.get('overlay_text') as string | null
  const notes   = formData.get('notes') as string | null
  const spend   = formData.get('spend') as string | null
  const impr    = formData.get('impressions') as string | null
  const ctr     = formData.get('ctr') as string | null
  const cpl     = formData.get('cpl') as string | null
  const leads   = formData.get('leads') as string | null

  if (!file || !niche) {
    return NextResponse.json({ error: 'image en niche zijn verplicht' }, { status: 400 })
  }

  const bytes     = await file.arrayBuffer()
  const ext       = file.name.split('.').pop() ?? 'jpg'
  const filename  = `${niche}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data: storageData, error: storageError } = await db.storage
    .from('winner-uploads')
    .upload(filename, bytes, { contentType: file.type, upsert: false })

  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })

  const { data: { publicUrl } } = db.storage
    .from('winner-uploads')
    .getPublicUrl(storageData.path)

  const { data, error } = await db.from('winners').insert({
    niche,
    image_url:    publicUrl,
    overlay_text: overlay?.trim() || null,
    notes:        notes?.trim()   || null,
    spend:        spend  ? parseFloat(spend)  : null,
    impressions:  impr   ? parseInt(impr, 10) : null,
    ctr:          ctr    ? parseFloat(ctr)    : null,
    cpl:          cpl    ? parseFloat(cpl)    : null,
    leads:        leads  ? parseInt(leads, 10): null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
