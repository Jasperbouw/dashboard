import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

export async function GET() {
  const db = serverClient()
  const { data, error } = await db
    .from('meta_spend_monthly')
    .select('id, year_month, amount_eur, notes, updated_at')
    .order('year_month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { year_month, amount_eur, notes } = await req.json()

  if (!year_month || amount_eur == null) {
    return NextResponse.json({ error: 'year_month and amount_eur required' }, { status: 400 })
  }

  // Normalise to first-of-month
  const ym   = String(year_month).slice(0, 7) // "YYYY-MM"
  const date = `${ym}-01`

  const db = serverClient()
  const { data, error } = await db
    .from('meta_spend_monthly')
    .upsert(
      { year_month: date, amount_eur: Number(amount_eur), notes: notes ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'year_month' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 200 })
}
