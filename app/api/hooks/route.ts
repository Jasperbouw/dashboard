import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../lib/supabase-server'

export async function GET() {
  const { data, error } = await serverClient()
    .from('hooks')
    .select('*')
    .order('niche')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, niche, description, visual_concept, status } = body as {
    name: string; niche: string; description: string
    visual_concept?: string; status?: string
  }

  if (!name?.trim() || !niche || !description?.trim()) {
    return NextResponse.json({ error: 'name, niche en description zijn verplicht' }, { status: 400 })
  }

  const { data, error } = await serverClient()
    .from('hooks')
    .insert({
      name:           name.trim(),
      niche,
      description:    description.trim(),
      visual_concept: visual_concept?.trim() || null,
      status:         status ?? 'testing',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
