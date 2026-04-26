import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

export async function GET() {
  const db = serverClient()
  const { data, error } = await db
    .from('revenue_niches')
    .select('name, display_order')
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json((data ?? []).map(r => r.name))
}

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const db = serverClient()
  const { error } = await db
    .from('revenue_niches')
    .insert({ name: name.trim().toLowerCase() })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
