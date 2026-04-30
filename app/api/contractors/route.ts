import { NextResponse } from 'next/server'
import { serverClient } from '../../../lib/supabase-server'

export async function GET() {
  const db = serverClient()

  const { data, error } = await db
    .from('contractors')
    .select('id, name, niche')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}
