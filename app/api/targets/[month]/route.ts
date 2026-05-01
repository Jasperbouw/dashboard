import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const { month } = await params
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Invalid month' }, { status: 400 })

  const { data } = await serverClient().from('monthly_targets').select('*').eq('month', month).maybeSingle()
  return NextResponse.json(data ?? null)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const { month } = await params
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Invalid month' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { deal_value_target, commission_target, ad_budget_target, notes } = body as {
    deal_value_target?: number | null; commission_target?: number | null
    ad_budget_target?: number | null; notes?: string | null
  }

  const db = serverClient()
  const { data, error } = await db.from('monthly_targets')
    .upsert({
      month,
      deal_value_target:  deal_value_target  ?? null,
      commission_target:  commission_target  ?? null,
      ad_budget_target:   ad_budget_target   ?? null,
      notes:              notes              ?? null,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'month' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
