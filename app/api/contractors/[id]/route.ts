import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../lib/supabase-server'

// GET — returns contractor + monday_board_id + account_label for edit modal pre-fill
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const [{ data: contractor }, { data: board }, { data: labelRow }] = await Promise.all([
    db.from('contractors').select('*').eq('id', id).single(),
    db.from('boards_config').select('id').eq('contractor_id', id).maybeSingle(),
    db.from('account_label_mapping').select('label').eq('contractor_id', id).maybeSingle(),
  ])

  if (!contractor) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  return NextResponse.json({
    ...contractor,
    monday_board_id: board?.id?.toString() ?? '',
    account_label:   labelRow?.label ?? '',
  })
}

// PATCH — partial update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    name, niche, service_model, commission_model,
    commission_rate, monday_board_id, account_label, notes,
  } = body as {
    name?:              string
    niche?:             string
    service_model?:     string
    commission_model?:  string
    commission_rate?:   number
    monday_board_id?:   string
    account_label?:     string
    notes?:             string | null
  }

  const db = serverClient()

  // Fetch existing state in parallel
  const [{ data: existing }, { data: existingBoard }, { data: existingLabelRow }] = await Promise.all([
    db.from('contractors').select('*').eq('id', id).single(),
    db.from('boards_config').select('id, column_map, stage_overrides, active').eq('contractor_id', id).maybeSingle(),
    db.from('account_label_mapping').select('id, label').eq('contractor_id', id).maybeSingle(),
  ])

  if (!existing) return NextResponse.json({ error: 'Contractor niet gevonden' }, { status: 404 })

  // ── Validate name uniqueness (exclude self) ──────────────────────────────────
  if (name !== undefined && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
    const { data: nameConflict } = await db
      .from('contractors').select('id')
      .ilike('name', name.trim())
      .neq('id', id)
      .maybeSingle()
    if (nameConflict) return NextResponse.json({ error: `Naam "${name.trim()}" is al in gebruik` }, { status: 409 })
  }

  // ── Validate Monday board ID ─────────────────────────────────────────────────
  let newBoardId: number | undefined
  if (monday_board_id !== undefined) {
    const parsed = parseInt(monday_board_id.toString().trim(), 10)
    if (isNaN(parsed)) return NextResponse.json({ error: 'Monday board ID moet numeriek zijn' }, { status: 400 })
    if (parsed !== existingBoard?.id) {
      const { data: boardConflict } = await db
        .from('boards_config').select('id').eq('id', parsed).maybeSingle()
      if (boardConflict) return NextResponse.json({ error: `Monday board ${parsed} is al gekoppeld` }, { status: 409 })
    }
    newBoardId = parsed
  }

  // ── Validate account label (exclude self) ────────────────────────────────────
  const newLabel = account_label?.trim() || null
  if (newLabel && newLabel !== existingLabelRow?.label) {
    const { data: labelConflict } = await db
      .from('account_label_mapping').select('id')
      .eq('label', newLabel)
      .neq('contractor_id', id)
      .maybeSingle()
    if (labelConflict) return NextResponse.json({ error: `Account label "${newLabel}" is al in gebruik` }, { status: 409 })
  }

  // ── Update contractors row ───────────────────────────────────────────────────
  const contractorPatch: Record<string, unknown> = {}
  if (name             !== undefined) contractorPatch.name             = name.trim()
  if (niche            !== undefined) contractorPatch.niche            = niche
  if (service_model    !== undefined) contractorPatch.service_model    = service_model
  if (commission_model !== undefined) contractorPatch.commission_model = commission_model
  if (commission_rate  !== undefined) contractorPatch.commission_rate  = Number(commission_rate)
  if (notes            !== undefined) contractorPatch.notes            = notes?.trim() || null

  if (Object.keys(contractorPatch).length > 0) {
    const { error } = await db.from('contractors').update(contractorPatch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // ── Update boards_config ─────────────────────────────────────────────────────
  const warnings: string[] = []
  const resolvedName  = (name?.trim() ?? existing.name)
  const resolvedNiche = niche ?? existing.niche

  if (existingBoard) {
    const boardPatch: Record<string, unknown> = {}
    // Sync name + niche mirror columns whenever they change
    if (name  !== undefined) boardPatch.name  = resolvedName
    if (niche !== undefined) boardPatch.niche = resolvedNiche
    // Change board ID: delete old row, insert new one preserving column_map
    if (newBoardId !== undefined && newBoardId !== existingBoard.id) {
      const { error: delErr } = await db.from('boards_config').delete().eq('id', existingBoard.id)
      if (delErr) return NextResponse.json({ error: `Board verwijderen: ${delErr.message}` }, { status: 400 })
      const { error: insErr } = await db.from('boards_config').insert({
        id:              newBoardId,
        name:            resolvedName,
        type:            'company',
        niche:           resolvedNiche,
        contractor_id:   id,
        column_map:      existingBoard.column_map,
        stage_overrides: existingBoard.stage_overrides,
        active:          existingBoard.active,
      })
      if (insErr) return NextResponse.json({ error: `Board toevoegen: ${insErr.message}` }, { status: 400 })
      warnings.push('Monday board ID gewijzigd — handmatige sync via /api/sync/monday aanbevolen')
    } else if (Object.keys(boardPatch).length > 0) {
      await db.from('boards_config').update(boardPatch).eq('id', existingBoard.id)
    }
  }

  // ── Update account_label_mapping ─────────────────────────────────────────────
  if (account_label !== undefined) {
    const hadLabel = !!existingLabelRow
    const hasLabel = !!newLabel

    if (!hadLabel && hasLabel) {
      const { error } = await db.from('account_label_mapping').insert({ label: newLabel, contractor_id: id })
      if (error) return NextResponse.json({ error: `Account label: ${error.message}` }, { status: 400 })
    } else if (hadLabel && hasLabel && newLabel !== existingLabelRow!.label) {
      const { error } = await db.from('account_label_mapping').update({ label: newLabel }).eq('contractor_id', id)
      if (error) return NextResponse.json({ error: `Account label: ${error.message}` }, { status: 400 })
    } else if (hadLabel && !hasLabel) {
      const { error } = await db.from('account_label_mapping').delete().eq('contractor_id', id)
      if (error) return NextResponse.json({ error: `Account label: ${error.message}` }, { status: 400 })
    }
  }

  // Return updated contractor
  const { data: updated } = await db.from('contractors').select('*').eq('id', id).single()
  return NextResponse.json({ ...(updated ?? {}), warnings: warnings.length ? warnings : undefined })
}
