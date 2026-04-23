import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { syncAllBoards } from '../lib/monday-sync'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function truncate() {
  console.log('Truncating leads, lead_status_changes, lead_updates, projects...')

  // Order matters: children before parents (cascade handles it but being explicit)
  const tables = ['lead_status_changes', 'lead_updates', 'leads', 'projects', 'sync_runs']
  for (const t of tables) {
    const { error } = await db.from(t).delete().gte('id', '00000000-0000-0000-0000-000000000000')
    if (error) { console.error(`  ✗ Failed to truncate ${t}: ${error.message}`); process.exit(1) }
  }

  // Verify empty
  for (const t of ['leads', 'projects', 'lead_status_changes']) {
    const { count } = await db.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ✓ ${t}: ${count} rows remaining`)
  }
}

async function main() {
  await truncate()

  console.log('\nStarting full Monday sync...\n')
  const start = Date.now()
  const result = await syncAllBoards()
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\nSync complete in ${elapsed}s`)
  console.log(`  Boards synced:    ${result.boardsSynced}`)
  console.log(`  Items synced:     ${result.itemsSynced}`)
  console.log(`  Items filtered:   ${result.itemsFiltered} (non-active, skipped)`)
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`)
    for (const e of result.errors) console.log(`    ${e.name}: ${e.error}`)
  }

  // Per-board count validation
  console.log('\nPer-board counts (Supabase vs Monday):')
  const { data: boards } = await db
    .from('boards_config')
    .select('id, name, type')
    .eq('active', true)

  for (const b of boards ?? []) {
    let count: number | null = null
    if (b.type === 'projects') {
      // projects table has no board_id; count all projects (single global board)
      const { count: c } = await db.from('projects').select('*', { count: 'exact', head: true })
      count = c
    } else {
      const { count: c } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('board_id', b.id)
      count = c
    }
    console.log(`  ${b.name.padEnd(34)} ${String(count ?? 0).padStart(5)} rows in Supabase`)
  }
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1) })
