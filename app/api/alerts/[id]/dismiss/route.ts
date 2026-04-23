import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const db = serverClient()

    const { error } = await db
      .from('alerts')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id)
      .is('dismissed_at', null)

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
