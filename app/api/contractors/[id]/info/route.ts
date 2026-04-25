import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const [{ data: contractor }, { data: contracts }] = await Promise.all([
    db.from('contractors')
      .select('created_at, location')
      .eq('id', id)
      .single(),
    db.from('contracts')
      .select('id, contractor_id')
      .eq('contractor_id', id),
  ])

  return NextResponse.json({
    created_at: contractor?.created_at ?? null,
    location:   contractor?.location   ?? null,
    contracts:  contracts ?? [],
  })
}
