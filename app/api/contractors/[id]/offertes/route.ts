import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'
import { getActiveContractors } from '../../../../../lib/metrics'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const [contractors, { data: openQuotes }, { data: wonProjects }, { data: lostLeads }] = await Promise.all([
    getActiveContractors(),

    // Open quotes — oldest first (most urgent at top)
    db.from('leads')
      .select('id, contact_name, quote_amount, board_id, monday_item_id, monday_created_at, current_status')
      .eq('contractor_id', id)
      .eq('canonical_stage', 'quote_sent')
      .order('monday_created_at', { ascending: true })
      .limit(50),

    // Won projects — most recent first
    db.from('projects')
      .select('project_name, aanneemsom, commissie, commissie_status, monday_created_at')
      .eq('contractor_id', id)
      .order('monday_created_at', { ascending: false })
      .limit(10),

    // Lost leads — most recent first, use current_status as reason
    db.from('leads')
      .select('contact_name, current_status, monday_created_at, board_id, monday_item_id')
      .eq('contractor_id', id)
      .eq('canonical_stage', 'lost')
      .order('monday_created_at', { ascending: false })
      .limit(10),
  ])

  const contractor = contractors.find(c => c.id === id)
  if (!contractor) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const isHandsOff = contractor.service_model === 'hands_off'

  const now = Date.now()
  function ageDays(iso: string | null): number {
    if (!iso) return 0
    return Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  }

  return NextResponse.json({
    service_model: contractor.service_model,
    is_hands_off:  isHandsOff,
    openQuotes: (openQuotes ?? []).map(q => ({
      id:           q.id,
      contact_name: q.contact_name,
      quote_amount: q.quote_amount,
      age_days:     ageDays(q.monday_created_at),
      monday_url:   `https://app.monday.com/boards/${q.board_id}/pulses/${q.monday_item_id}`,
      current_status: q.current_status,
    })),
    wonProjects: (wonProjects ?? []).map(p => ({
      project_name:     p.project_name,
      aanneemsom:       p.aanneemsom,
      commissie:        p.commissie,
      commissie_status: p.commissie_status,
      date:             p.monday_created_at,
    })),
    lostLeads: (lostLeads ?? []).map(l => ({
      contact_name: l.contact_name,
      reason:       l.current_status,
      date:         l.monday_created_at,
      monday_url:   `https://app.monday.com/boards/${l.board_id}/pulses/${l.monday_item_id}`,
    })),
  })
}
