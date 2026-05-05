import { NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

export async function GET() {
  const { data, error } = await serverClient()
    .from('creative_batches')
    .select('id, run_date, niches, total_creatives, status, error_log, started_at, completed_at')
    .order('started_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
