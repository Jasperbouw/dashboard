import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../lib/supabase-server'
import { syncSpecificBoards } from '../../../lib/monday-sync'

// Column IDs that are consistent across all contractor boards.
// campaign_tag and follow_up differ per board — omit from defaults.
const DEFAULT_COLUMN_MAP = {
  phone:       'contact_phone',
  email:       'text_mksk3arq',
  status:      'color_mkskgdv2',
  urgentie:    'long_text_mktfh12b',
  dienst:      'text_mkskv446',
  m2:          'text_mkskn3bq',
  tekening:    'text_mkskb49d',
  postcode:    'text_mksk8j3',
  straat:      'text_mkskpdsk',
  opmerkingen: 'long_text4',
}

export async function GET() {
  const db = serverClient()

  const { data, error } = await db
    .from('contractors')
    .select('id, name, niche')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    name, niche, service_model, commission_model, commission_rate,
    monday_board_id, notes, account_label,
  } = body as {
    name: string; niche: string; service_model: string; commission_model: string
    commission_rate: number; monday_board_id: string; notes?: string; account_label?: string
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  if (!name?.trim())           return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  if (!niche)                  return NextResponse.json({ error: 'Niche is verplicht' }, { status: 400 })
  if (!service_model)          return NextResponse.json({ error: 'Servicemodel is verplicht' }, { status: 400 })
  if (!commission_model)       return NextResponse.json({ error: 'Commissiemodel is verplicht' }, { status: 400 })
  if (commission_rate == null) return NextResponse.json({ error: 'Commissie waarde is verplicht' }, { status: 400 })
  if (!monday_board_id?.trim()) return NextResponse.json({ error: 'Monday board ID is verplicht' }, { status: 400 })

  const boardId = parseInt(monday_board_id.trim(), 10)
  if (isNaN(boardId)) return NextResponse.json({ error: 'Monday board ID moet numeriek zijn' }, { status: 400 })

  const db = serverClient()

  // Check name uniqueness
  const { data: existing } = await db
    .from('contractors')
    .select('id')
    .ilike('name', name.trim())
    .maybeSingle()
  if (existing) return NextResponse.json({ error: `Contractor "${name.trim()}" bestaat al` }, { status: 409 })

  // Check Monday board ID not already in use
  const { data: existingBoard } = await db
    .from('boards_config')
    .select('id')
    .eq('id', boardId)
    .maybeSingle()
  if (existingBoard) return NextResponse.json({ error: `Monday board ${boardId} is al gekoppeld` }, { status: 409 })

  // Check account_label uniqueness if provided
  if (account_label?.trim()) {
    const { data: existingLabel } = await db
      .from('account_label_mapping')
      .select('id')
      .eq('label', account_label.trim())
      .maybeSingle()
    if (existingLabel) return NextResponse.json({ error: `Account label "${account_label.trim()}" is al in gebruik` }, { status: 409 })
  }

  // ── Insert contractor ────────────────────────────────────────────────────────
  const { data: contractor, error: cErr } = await db
    .from('contractors')
    .insert({
      name:              name.trim(),
      niche,
      service_model,
      commission_model,
      commission_rate:   Number(commission_rate),
      relationship_status: 'active',
      active:            true,
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
    })
    .select()
    .single()

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 })

  // ── Insert boards_config ─────────────────────────────────────────────────────
  const { error: bErr } = await db.from('boards_config').insert({
    id:             boardId,
    name:           name.trim(),
    type:           'company',
    niche,
    contractor_id:  contractor.id,
    column_map:     DEFAULT_COLUMN_MAP,
    stage_overrides: {},
    active:         true,
  })

  if (bErr) {
    // Rollback contractor
    await db.from('contractors').delete().eq('id', contractor.id)
    return NextResponse.json({ error: `Board config: ${bErr.message}` }, { status: 400 })
  }

  // ── Insert account_label_mapping if provided ─────────────────────────────────
  if (account_label?.trim()) {
    const { error: lErr } = await db.from('account_label_mapping').insert({
      label:         account_label.trim(),
      contractor_id: contractor.id,
    })
    if (lErr) {
      // Rollback both
      await db.from('boards_config').delete().eq('id', boardId)
      await db.from('contractors').delete().eq('id', contractor.id)
      return NextResponse.json({ error: `Account label: ${lErr.message}` }, { status: 400 })
    }
  }

  // ── Trigger initial sync for the new board (fire-and-forget after response) ──
  syncSpecificBoards([boardId]).catch(err =>
    console.error(`[onboard] Initial sync failed for board ${boardId}:`, err)
  )

  return NextResponse.json(contractor, { status: 201 })
}
