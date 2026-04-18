import { SupabaseClient } from '@supabase/supabase-js'
import { mondayQuery } from './monday'
import { serverClient } from './supabase-server'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoardConfig {
  id: number
  name: string
  type: 'general' | 'company' | 'projects'
  contractor_id: string | null
  column_map: Record<string, string>
}

interface MondayItem {
  id: string
  name: string
  created_at: string
  updated_at: string
  group: { id: string; title: string }
  column_values: Array<{ id: string; text: string; value: string }>
}

interface SyncBoardResult {
  boardId: number
  itemsSynced: number
  error?: string
}

// ── GraphQL queries ───────────────────────────────────────────────────────────

const ITEM_FIELDS = `
  id
  name
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

function parseDate(val: string): string | null {
  if (!val) return null
  // Monday returns dates as "YYYY-MM-DD" in text field
  return val.match(/^\d{4}-\d{2}-\d{2}$/) ? val : null
}

// ── Lead upsert ───────────────────────────────────────────────────────────────

async function upsertLead(
  item: MondayItem,
  board: BoardConfig,
  db: SupabaseClient
): Promise<void> {
  const cm = board.column_map

  const contactName  = item.name
  const phone        = col(item, cm.phone)
  const email        = col(item, cm.email)
  const campaignTag  = col(item, cm.campaign_tag)
  const urgentie     = col(item, cm.urgentie)
  const dienst       = col(item, cm.dienst)
  const m2           = col(item, cm.m2)
  const tekening     = col(item, cm.tekening)
  const postcode     = col(item, cm.postcode)
  const straat       = col(item, cm.straat)
  const followUpRaw  = col(item, cm.follow_up)
  const currentStatus = item.group.title

  const rawColumnValues: Record<string, string> = {}
  for (const cv of item.column_values) rawColumnValues[cv.id] = cv.text

  // Check existing status for change tracking
  const { data: existing } = await db
    .from('leads')
    .select('id, current_status')
    .eq('monday_item_id', item.id)
    .maybeSingle()

  const now = new Date().toISOString()

  const { data: upserted, error } = await db
    .from('leads')
    .upsert({
      monday_item_id:    item.id,
      board_id:          board.id,
      contractor_id:     board.contractor_id,
      contact_name:      contactName,
      phone:             phone || null,
      email:             email || null,
      campaign_tag:      campaignTag || null,
      urgentie:          urgentie || null,
      dienst:            dienst || null,
      m2:                m2 || null,
      tekening:          tekening || null,
      postcode:          postcode || null,
      straat:            straat || null,
      current_status:    currentStatus,
      follow_up_date:    parseDate(followUpRaw),
      raw_column_values: rawColumnValues,
      monday_created_at: item.created_at,
      monday_updated_at: item.updated_at,
      synced_at:         now,
    }, { onConflict: 'monday_item_id' })
    .select('id')
    .single()

  if (error) throw new Error(`Lead upsert failed for item ${item.id}: ${error.message}`)

  // Write status change if status shifted
  if (existing && existing.current_status !== currentStatus) {
    await db.from('lead_status_changes').insert({
      lead_id:    upserted.id,
      from_status: existing.current_status,
      to_status:   currentStatus,
      changed_at:  now,
    })
  }
}

// ── Project upsert ────────────────────────────────────────────────────────────

async function upsertProject(
  item: MondayItem,
  board: BoardConfig,
  db: SupabaseClient
): Promise<void> {
  const cm = board.column_map

  const aanneemsom = col(item, cm.aanneemsom)
  const commissie  = col(item, cm.commissie)

  // Find matching contractor via Accounts board_relation — not available in
  // column_values text, so we leave contractor_id null for now; it can be
  // set manually or matched by campaign_tag in a later enrichment pass.

  const rawColumnValues: Record<string, string> = {}
  for (const cv of item.column_values) rawColumnValues[cv.id] = cv.text

  // Parse timeline (value field contains JSON with "from" and "to")
  let timelineStart: string | null = null
  let timelineEnd: string | null = null
  const timelineCol = item.column_values.find(cv => cv.id === cm.timeline)
  if (timelineCol?.value) {
    try {
      const tl = JSON.parse(timelineCol.value)
      timelineStart = tl.from ?? null
      timelineEnd   = tl.to ?? null
    } catch {}
  }

  await db.from('projects').upsert({
    monday_item_id:    item.id,
    contractor_id:     board.contractor_id,
    project_name:      item.name,
    aanneemsom:        aanneemsom ? parseFloat(aanneemsom.replace(/[^0-9.]/g, '')) || null : null,
    betaal_status:     col(item, cm.betaal_status) || null,
    commissie:         commissie ? parseFloat(commissie.replace(/[^0-9.]/g, '')) || null : null,
    commissie_status:  col(item, cm.commissie_status) || null,
    contract_status:   col(item, cm.contract) || null,
    timeline_start:    parseDate(timelineStart ?? ''),
    timeline_end:      parseDate(timelineEnd ?? ''),
    raw_column_values: rawColumnValues,
    monday_created_at: item.created_at,
    monday_updated_at: item.updated_at,
    synced_at:         new Date().toISOString(),
  }, { onConflict: 'monday_item_id' })
}

// ── Sync a single board ───────────────────────────────────────────────────────

async function syncBoard(board: BoardConfig, db: SupabaseClient): Promise<SyncBoardResult> {
  let itemsSynced = 0
  let cursor: string | null = null
  let isFirstPage = true

  try {
    while (true) {
      const query: string = isFirstPage ? firstPageQuery(board.id) : nextPageQuery(cursor!)
      const data: any = await mondayQuery<any>(query)

      const page: any = isFirstPage
        ? data.boards?.[0]?.items_page
        : data.next_items_page

      if (!page) break

      const items: MondayItem[] = page.items ?? []

      for (const item of items) {
        if (board.type === 'projects') {
          await upsertProject(item, board, db)
        } else {
          await upsertLead(item, board, db)
        }
        itemsSynced++
      }

      cursor = page.cursor ?? null
      isFirstPage = false
      if (!cursor) break
    }

    return { boardId: board.id, itemsSynced }
  } catch (err: any) {
    return { boardId: board.id, itemsSynced, error: err.message }
  }
}

// ── Public: sync all active boards ───────────────────────────────────────────

export async function syncAllBoards(): Promise<{
  boardsSynced: number
  itemsSynced: number
  errors: Array<{ boardId: number; error: string }>
}> {
  const db = serverClient()

  // Create sync run record
  const { data: run } = await db
    .from('sync_runs')
    .insert({ status: 'running' })
    .select('id')
    .single()
  const runId = run?.id

  const { data: boards, error: bErr } = await db
    .from('boards_config')
    .select('id, name, type, contractor_id, column_map')
    .eq('active', true)

  if (bErr || !boards) {
    await db.from('sync_runs').update({ status: 'failed', finished_at: new Date().toISOString(), errors: [{ message: bErr?.message }] }).eq('id', runId)
    throw new Error(`Failed to load boards_config: ${bErr?.message}`)
  }

  const results = await Promise.allSettled(
    boards.map(b => syncBoard(b as BoardConfig, db))
  )

  const successes = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<SyncBoardResult>).value)
  const errors = successes.filter(r => r.error).map(r => ({ boardId: r.boardId, error: r.error! }))

  const totalItems = successes.reduce((sum, r) => sum + r.itemsSynced, 0)
  const finalStatus = errors.length === 0 ? 'success' : errors.length < boards.length ? 'partial' : 'failed'

  await db.from('sync_runs').update({
    status:        finalStatus,
    finished_at:   new Date().toISOString(),
    boards_synced: successes.filter(r => !r.error).length,
    items_synced:  totalItems,
    errors:        errors.length > 0 ? errors : null,
  }).eq('id', runId)

  return {
    boardsSynced: successes.filter(r => !r.error).length,
    itemsSynced:  totalItems,
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
