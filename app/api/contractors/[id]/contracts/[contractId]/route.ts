import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../../lib/supabase-server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> },
) {
  const { id, contractId } = await params
  const db = serverClient()

  const { error } = await db
    .from('contractor_contracts')
    .update({ status: 'archived' })
    .eq('id', contractId)
    .eq('contractor_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
