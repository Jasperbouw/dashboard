import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    const db = serverClient()

    let query = db
      .from('alerts')
      .select(`
        id, type, severity, title, body, natural_key,
        triggered_at, resolved_at, dismissed_at, meta,
        contractor_id, lead_id,
        contractors(id, name),
        leads(id, contact_name)
      `)
      .is('resolved_at', null)
      .order('triggered_at', { ascending: false })
      .limit(limit)

    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json({ alerts: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
