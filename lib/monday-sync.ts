import { SupabaseClient } from '@supabase/supabase-js'
import { mondayQuery } from './monday'
import { serverClient } from './supabase-server'
import { parseEuroAmount } from './utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoardConfig {
  id: number
  name: string
  type: 'general' | 'company' | 'projects'
  contractor_id: string | null
  column_map: Record<string, string>
  stage_overrides: Record<string, string>   // current_status → canonical_stage, board-specific
}

interface MondayItem {
  id: string
  name: string
  state: string            // 'active' | 'deleted' | 'archived'
  created_at: string
  updated_at: string
  group: { id: string; title: string }
  column_values: Array<{ id: string; text: string; value: string }>
}

interface SyncBoardResult {
  boardId: number
  itemsFetched: number
  itemsFiltered: number   // non-active, skipped
  itemsSynced: number
  error?: string
}

// ── Canonical stage mapping ───────────────────────────────────────────────────

const STAGE_MAP: Record<string, string> = {
  // new
  'open leads':                                        'new',
  'open leads huidig':                                 'new',
  'nieuwe lead':                                       'new',
  // contacted
  '1x gebeld':                                         'contacted',
  '2x gebeld':                                         'contacted',
  '3x gebeld':                                         'contacted',
  '4x gebeld':                                         'contacted',
  'gebeld':                                            'contacted',
  'gesproken':                                         'contacted',
  'inplannen':                                         'contacted',
  'in afwachting bevestiging':                         'contacted',
  // inspection
  'inspectie gepland':                                 'inspection',
  'afspraak gepland':                                  'inspection',
  // quote_sent
  'offerte verzonden':                                 'quote_sent',
  'offerte verstuurd':                                 'quote_sent',
  'laatste poging':                                    'quote_sent',
  // won — "Doorgestuurd" removed from global map; handled per-board via stage_overrides
  'akkoord':                                           'won',
  // deferred
  'later opvolgen':                                    'deferred',
  'opvolgen':                                          'deferred',
  'follow up later':                                   'deferred',
  // lost
  'niet bereikbaar':                                   'lost',
  'niet bereikbaar/geinteresseerd/al voorzien':        'lost',
  'niet bereikbaar/geïnteresseerd/al voorzien':        'lost',
  'niet bereikbaar/al voorzien':                       'lost',
  'offerte afgewezen':                                 'lost',
  'niet geïnteresseerd':                               'lost',
  'geïnteresseerd':                                    'lost',
  'al voorzien':                                       'lost',
}

const unknownStages = new Set<string>()

// Board-specific overrides take priority over the global STAGE_MAP.
function toCanonicalStage(status: string, stageOverrides?: Record<string, string>): string | null {
  if (stageOverrides) {
    const override = stageOverrides[status]
    if (override) return override
  }
  const key = status.trim().toLowerCase()
  const stage = STAGE_MAP[key]
  if (!stage) {
    if (!unknownStages.has(status)) {
      unknownStages.add(status)
      console.warn(`  ⚠ Unknown status → canonical_stage=NULL: "${status}"`)
    }
    return null
  }
  return stage
}

// ── GraphQL queries ───────────────────────────────────────────────────────────

// state field filters out deleted/archived items client-side
const ITEM_FIELDS = `
  id
  name
  state
  created_at
  updated_at
  group { id title }
  column_values { id text value }
`

function firstPageQuery(boardId: number): string {
  return `{
    boards(ids: [${boardId}]) {
      items_page(limit: 500) {
        cursor
        items { ${ITEM_FIELDS} }
      }
    }
  }`
}

function nextPageQuery(cursor: string): string {
  return `{
    next_items_page(limit: 500, cursor: "${cursor}") {
      cursor
      items { ${ITEM_FIELDS} }
    }
  }`
}

// ── Column extraction ─────────────────────────────────────────────────────────

function col(item: MondayItem, columnId: string | undefined): string {
  if (!columnId) return ''
  return item.column_values.find(cv => cv.id === columnId)?.text?.trim() ?? ''
}

function colValue(item: MondayItem, columnId: string | undefined): string {
  if (!columnId) return ''
  return item.column_values.find(cv => cv.id === columnId)?.value?.trim() ?? ''
}

function parseDate(val: string): string | null {
  if (!val) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : null
}

// ── Project contractor resolution ─────────────────────────────────────────────
// Priority order for resolving contractor_id on project items:
//   1. Hardcoded item ID overrides (for items with no label in Monday)
//   2. account_label_mapping lookup via connect_boards column text
//   3. board.contractor_id fallback (null for Client Projects board)

// Hardcoded Monday item ID → contractor name.
// These are historical projects that were created before the Accounts label
// column was consistently filled in Monday.com. New projects should have the
// Accounts label set at creation time so they resolve via account_label_mapping.
// This list should NOT grow over time — it is a one-time historical cleanup.
const PROJECT_ITEM_OVERRIDES: Record<string, string> = {
  // AM Topdaken (archived) — phased-out contractor
  '2700023583': 'AM Topdaken (archived)', // Paul van Rangelrooy
  '2711109452': 'AM Topdaken (archived)', // Marco De Kort
  '2711122989': 'AM Topdaken (archived)', // Ben Brooks
  // Dakcentrale Nederland (DK) — flat €250 dakkapel commission
  '2828760219': 'Dakcentrale Nederland (DK)', // Bart Vd Weijden
  '2825561340': 'Dakcentrale Nederland (DK)', // Laura Bergstra
  '2818714645': 'Dakcentrale Nederland (DK)', // Farida Poeder
  '2826055686': 'Dakcentrale Nederland (DK)', // Mw. Smith
  '2791830054': 'Dakcentrale Nederland (DK)', // Jason Shepherd
  '2791830103': 'Dakcentrale Nederland (DK)', // Joanne Prinsloo
  '2791839966': 'Dakcentrale Nederland (DK)', // Amar Rambaran
  '2791844979': 'Dakcentrale Nederland (DK)', // Marco Pijnaker
  '2791837243': 'Dakcentrale Nederland (DK)', // Marc Helmink
  '2791832241': 'Dakcentrale Nederland (DK)', // rowin
  '2791832148': 'Dakcentrale Nederland (DK)', // Chahia Farissi
  '2791832343': 'Dakcentrale Nederland (DK)', // Bert Steinbach
  '2791844985': 'Dakcentrale Nederland (DK)', // Jan de Boer
  '2791837247': 'Dakcentrale Nederland (DK)', // Ryan Mallin
  // Dakcentrale Nederland (DD) — daken projects, 100% betaald
  '2791391501': 'Dakcentrale Nederland (DD)', // Walter Jonkers
  '2791377406': 'Dakcentrale Nederland (DD)', // Serina Roozen (copy)
  // Hollands Prefab — large bouw project
  '2811206064': 'Hollands Prefab',             // Monique de Jong
  // Jongsma Dakbedekkingen — variable commissie daken projects
  '2828757640': 'Jongsma Dakbedekkingen',      // Louis Jungschlager
  '2791414687': 'Jongsma Dakbedekkingen',      // Elisa Falsetti
  '2791405733': 'Jongsma Dakbedekkingen',      // Cees Miedema
  '2791418702': 'Jongsma Dakbedekkingen',      // Richard de Jong
  '2793497341': 'Jongsma Dakbedekkingen',      // Bert Buring
  '2791418743': 'Jongsma Dakbedekkingen',      // S Bella Stankovic
}

async function buildLabelContractorMap(db: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await db
    .from('account_label_mapping')
    .select('label, contractor_id')
  if (error || !data) {
    console.warn(`  ⚠ Could not load account_label_mapping: ${error?.message}`)
    return new Map()
  }
  const map = new Map<string, string>()
  for (const row of data) {
    if (row.contractor_id) map.set(row.label, row.contractor_id)
  }
  console.log(`  ✓ Label map: ${map.size} entries loaded`)
  return map
}

// ── Lead upsert ───────────────────────────────────────────────────────────────

async function upsertLead(
  item: MondayItem,
  board: BoardConfig,
  db: SupabaseClient
): Promise<void> {
  const cm = board.column_map

  const currentStatus  = item.group.title
  const canonicalStage = toCanonicalStage(currentStatus, board.stage_overrides)
  const followUpRaw    = col(item, cm.follow_up)

  const rawColumnValues: Record<string, string> = {}
  for (const cv of item.column_values) rawColumnValues[cv.id] = cv.text

  // Check existing for status change tracking
  const { data: existing } = await db
    .from('leads')
    .select('id, current_status')
    .eq('monday_item_id', item.id)
    .maybeSingle()

  const now = new Date().toISOString()

  const quoteAmountRaw = col(item, cm.quote_amount)
  const quoteAmount    = quoteAmountRaw ? parseEuroAmount(quoteAmountRaw) : null

  const { data: upserted, error } = await db
    .from('leads')
    .upsert({
      monday_item_id:    item.id,
      board_id:          board.id,
      contractor_id:     board.contractor_id,
      contact_name:      item.name,
      phone:             col(item, cm.phone) || null,
      email:             col(item, cm.email) || null,
      campaign_tag:      col(item, cm.campaign_tag) || null,
      urgentie:          col(item, cm.urgentie) || null,
      dienst:            col(item, cm.dienst) || null,
      m2:                col(item, cm.m2) || null,
      tekening:          col(item, cm.tekening) || null,
      postcode:          col(item, cm.postcode) || null,
      straat:            col(item, cm.straat) || null,
      current_status:    currentStatus,
      canonical_stage:   canonicalStage,
      follow_up_date:    parseDate(followUpRaw),
      quote_amount:      quoteAmount,
      raw_column_values: rawColumnValues,
      monday_created_at: item.created_at,
      monday_updated_at: item.updated_at,
      synced_at:         now,
    }, { onConflict: 'monday_item_id' })
    .select('id')
    .single()

  if (error) throw new Error(`Lead upsert failed for item ${item.id}: ${error.message}`)

  if (existing && existing.current_status !== currentStatus) {
    // creator_name / creator_user_id: not yet available from Monday webhook payload.
    // Columns added 2026-04-20 — populate once webhook includes actor context.
    const insertResult = await db.from('lead_status_changes').insert({
      lead_id:          upserted.id,
      from_status:      existing.current_status,
      to_status:        currentStatus,
      changed_at:       now,
      creator_name:     null,
      creator_user_id:  null,
    })
    if (insertResult.error) {
      console.warn(`[sync] lead_status_changes insert warning for lead ${upserted.id}:`, insertResult.error.message)
    }
  }
}

// ── Project upsert ────────────────────────────────────────────────────────────

async function upsertProject(
  item: MondayItem,
  board: BoardConfig,
  labelMap: Map<string, string>,
  db: SupabaseClient
): Promise<void> {
  const cm = board.column_map

  // Resolve contractor_id — priority: item override → label → board default
  let contractorId: string | null = board.contractor_id

  const overrideName = PROJECT_ITEM_OVERRIDES[item.id]
  if (overrideName) {
    const { data: c } = await db.from('contractors').select('id').eq('name', overrideName).maybeSingle()
    if (c) contractorId = c.id
  } else {
    const labelText = col(item, 'connect_boards').trim()
    if (labelText) {
      const cid = labelMap.get(labelText)
      if (cid) {
        contractorId = cid
      } else {
        console.warn(`  ⚠ Unknown Accounts label "${labelText}" on project item ${item.id} — contractor_id=NULL`)
      }
    }
  }

  const rawColumnValues: Record<string, string> = {}
  for (const cv of item.column_values) rawColumnValues[cv.id] = cv.text

  // Parse timeline (value field: JSON with "from"/"to" date strings)
  let timelineStart: string | null = null
  let timelineEnd: string | null = null
  const timelineVal = colValue(item, cm.timeline)
  if (timelineVal) {
    try {
      const tl = JSON.parse(timelineVal)
      timelineStart = parseDate(tl.from ?? '')
      timelineEnd   = parseDate(tl.to ?? '')
    } catch {}
  }

  const { error } = await db.from('projects').upsert({
    monday_item_id:    item.id,
    contractor_id:     contractorId,
    project_name:      item.name,
    aanneemsom:        parseEuroAmount(col(item, cm.aanneemsom)),
    betaal_status:     col(item, cm.betaal_status) || null,
    commissie:         parseEuroAmount(col(item, cm.commissie)),
    commissie_status:  col(item, cm.commissie_status) || null,
    contract_status:   col(item, cm.contract) || null,
    timeline_start:    timelineStart,
    timeline_end:      timelineEnd,
    raw_column_values: rawColumnValues,
    monday_created_at: item.created_at,
    monday_updated_at: item.updated_at,
    synced_at:         new Date().toISOString(),
  }, { onConflict: 'monday_item_id' })

  if (error) throw new Error(`Project upsert failed for item ${item.id}: ${error.message}`)
}

// ── Sync a single board ───────────────────────────────────────────────────────

async function syncBoard(
  board: BoardConfig,
  db: SupabaseClient,
  labelMap: Map<string, string>
): Promise<SyncBoardResult> {
  let itemsFetched  = 0
  let itemsFiltered = 0
  let itemsSynced   = 0
  let cursor: string | null = null
  let isFirstPage = true

  try {
    while (true) {
      const query: string = isFirstPage ? firstPageQuery(board.id) : nextPageQuery(cursor!)
      const data: any    = await mondayQuery<any>(query)
      const page: any    = isFirstPage ? data.boards?.[0]?.items_page : data.next_items_page

      if (!page) break

      const items: MondayItem[] = page.items ?? []
      itemsFetched += items.length

      for (const item of items) {
        if (item.state !== 'active') {
          itemsFiltered++
          continue
        }

        if (board.type === 'projects') {
          await upsertProject(item, board, labelMap, db)
        } else {
          await upsertLead(item, board, db)
        }
        itemsSynced++
      }

      cursor = page.cursor ?? null
      isFirstPage = false
      if (!cursor) break
    }

    // Post-sync validation
    if (itemsFiltered > 0) {
      console.log(`  ⚠ Board ${board.id} (${board.name}): ${itemsFetched} fetched, ${itemsFiltered} filtered (non-active), ${itemsSynced} persisted`)
    }

    return { boardId: board.id, itemsFetched, itemsFiltered, itemsSynced }
  } catch (err: any) {
    return { boardId: board.id, itemsFetched, itemsFiltered, itemsSynced, error: err.message }
  }
}

// ── Public: sync all active boards ───────────────────────────────────────────

export async function syncAllBoards(): Promise<{
  boardsSynced: number
  itemsSynced: number
  itemsFiltered: number
  errors: Array<{ boardId: number; name: string; error: string }>
}> {
  const db = serverClient()

  const { data: run } = await db
    .from('sync_runs')
    .insert({ status: 'running' })
    .select('id')
    .single()
  const runId = run?.id

  const { data: boards, error: bErr } = await db
    .from('boards_config')
    .select('id, name, type, contractor_id, column_map, stage_overrides')
    .eq('active', true)

  if (bErr || !boards) {
    await db.from('sync_runs').update({
      status: 'failed', finished_at: new Date().toISOString(), errors: [{ message: bErr?.message }]
    }).eq('id', runId)
    throw new Error(`Failed to load boards_config: ${bErr?.message}`)
  }

  // Build label→contractor map once (from account_label_mapping table)
  console.log('Building label → contractor map...')
  const labelMap = await buildLabelContractorMap(db)

  const results = await Promise.allSettled(
    boards.map(b => syncBoard(b as BoardConfig, db, labelMap))
  )

  const successes = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<SyncBoardResult>).value)

  const errors = successes
    .filter(r => r.error)
    .map(r => ({ boardId: r.boardId, name: boards.find(b => b.id === r.boardId)?.name ?? '', error: r.error! }))

  const totalSynced   = successes.reduce((s, r) => s + r.itemsSynced, 0)
  const totalFiltered = successes.reduce((s, r) => s + r.itemsFiltered, 0)
  const finalStatus   = errors.length === 0 ? 'success' : errors.length < boards.length ? 'partial' : 'failed'

  await db.from('sync_runs').update({
    status:        finalStatus,
    finished_at:   new Date().toISOString(),
    boards_synced: successes.filter(r => !r.error).length,
    items_synced:  totalSynced,
    errors:        errors.length > 0 ? errors : null,
  }).eq('id', runId)

  return {
    boardsSynced:  successes.filter(r => !r.error).length,
    itemsSynced:   totalSynced,
    itemsFiltered: totalFiltered,
    errors,
  }
}

// ── Public: sync specific boards by ID ───────────────────────────────────────

export async function syncSpecificBoards(boardIds: number[]): Promise<{
  boardsSynced: number
  itemsSynced: number
  errors: Array<{ boardId: number; name: string; error: string }>
}> {
  const db = serverClient()

  const { data: boards, error: bErr } = await db
    .from('boards_config')
    .select('id, name, type, contractor_id, column_map, stage_overrides')
    .in('id', boardIds)
    .eq('active', true)

  if (bErr || !boards) throw new Error(`Failed to load boards_config: ${bErr?.message}`)

  const labelMap = await buildLabelContractorMap(db)

  const results = await Promise.allSettled(
    boards.map(b => syncBoard(b as BoardConfig, db, labelMap))
  )

  const successes = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<SyncBoardResult>).value)

  const errors = successes
    .filter(r => r.error)
    .map(r => ({ boardId: r.boardId, name: boards.find(b => b.id === r.boardId)?.name ?? '', error: r.error! }))

  return {
    boardsSynced: successes.filter(r => !r.error).length,
    itemsSynced:  successes.reduce((s, r) => s + r.itemsSynced, 0),
    errors,
  }
}

// ── Public: last sync status ─────────────────────────────────────────────────

export async function lastSyncRun() {
  const db = serverClient()
  const { data } = await db
    .from('sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
