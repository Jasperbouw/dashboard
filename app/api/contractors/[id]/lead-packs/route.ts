import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: contractorId } = await params
  const db = serverClient()

  const { data: packs, error } = await db
    .from('lead_packs')
    .select('*')
    .eq('contractor_id', contractorId)
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = new Date()

  const enriched = await Promise.all((packs ?? []).map(async (pack) => {
    if (pack.pack_type === 'lead_based') {
      let query = db
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('contractor_id', contractorId)
        .gte('monday_created_at', pack.started_at)

      if (pack.completed_at) {
        query = query.lte('monday_created_at', pack.completed_at)
      }

      const { count } = await query
      return { ...pack, units_used: count ?? 0 }
    }
    return pack
  }))

  return NextResponse.json(enriched)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: contractorId } = await params
  const body = await req.json()
  const { niche, pack_type, units_promised, amount_paid, started_at, notes, related_revenue_entry_id } = body

  if (!niche || !pack_type || !units_promised || !started_at) {
    return NextResponse.json({ error: 'niche, pack_type, units_promised en started_at zijn verplicht' }, { status: 400 })
  }

  const db = serverClient()

  const { data, error } = await db
    .from('lead_packs')
    .insert({
      contractor_id: contractorId,
      niche,
      pack_type,
      units_promised: Number(units_promised),
      units_used: 0,
      amount_paid: amount_paid ? Number(amount_paid) : null,
      started_at,
      status: 'active',
      notes: notes || null,
      related_revenue_entry_id: related_revenue_entry_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
