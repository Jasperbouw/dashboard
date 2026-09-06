import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../lib/supabase-server'

export async function GET() {
  const db = serverClient()
  const { data, error } = await db
    .from('greenteam_deals')
    .select('*')
    .order('closed_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const {
    client_name, location, closed_at, status,
    deal_value, commission_pct, commission_amount,
    product_thuisbatterij, product_warmtepomp, product_zonnepanelen,
    financing_warmtefonds, financing_eigen, financing_svn,
    lead_source, notes,
  } = body as Record<string, unknown>

  if (!client_name || !closed_at || deal_value == null || commission_amount == null) {
    return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
  }

  const db = serverClient()
  const { data, error } = await db
    .from('greenteam_deals')
    .insert({
      client_name,
      location:              location ?? null,
      closed_at,
      status:                status ?? 'akkoord',
      deal_value:            Number(deal_value),
      commission_pct:        Number(commission_pct ?? 10),
      commission_amount:     Number(commission_amount),
      product_thuisbatterij: Boolean(product_thuisbatterij),
      product_warmtepomp:    Boolean(product_warmtepomp),
      product_zonnepanelen:  Boolean(product_zonnepanelen),
      financing_warmtefonds: Boolean(financing_warmtefonds),
      financing_eigen:       Boolean(financing_eigen),
      financing_svn:         Boolean(financing_svn),
      lead_source:           lead_source ?? null,
      notes:                 notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
