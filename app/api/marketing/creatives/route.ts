import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status    = searchParams.get('status')
  const batchDate = searchParams.get('date')

  let q = serverClient()
    .from('creatives')
    .select(`
      id, niche, batch_date, batch_id,
      copy_headline, copy_body, copy_cta, angle_description,
      image_url, status, rejection_reason, reviewed_at, created_at,
      source_winner_id,
      winners ( overlay_text, notes )
    `)
    .order('created_at', { ascending: false })

  if (status)    q = q.eq('status', status)
  if (batchDate) q = q.eq('batch_date', batchDate)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
