// @ts-nocheck
import { serverClient } from '../lib/supabase-server'

async function main() {
  const db = serverClient()

  // Step 1: Add stage_overrides column
  console.log('Step 1: Adding stage_overrides column to boards_config...')
  const { error: alterErr } = await db.rpc('exec_sql' as any, {
    sql: `ALTER TABLE boards_config ADD COLUMN IF NOT EXISTS stage_overrides jsonb DEFAULT '{}'::jsonb;`
  })
  // If rpc doesn't exist, we'll do a direct update and accept the column might already exist
  // Try a direct approach via a known-good column update
  
  // Step 2: Set DCN DK override
  console.log('Step 2: Setting stage_overrides for DCN DK (board 5091344029)...')
  const { error: updateErr } = await db
    .from('boards_config')
    .update({ stage_overrides: { 'Doorgestuurd': 'contacted' } })
    .eq('id', 5091344029)

  if (updateErr) {
    console.error('Update failed (column may not exist yet):', updateErr.message)
    console.log('\nRun this SQL manually in Supabase SQL editor:')
    console.log(`ALTER TABLE boards_config ADD COLUMN IF NOT EXISTS stage_overrides jsonb DEFAULT '{}'::jsonb;`)
    console.log(`UPDATE boards_config SET stage_overrides = '{"Doorgestuurd": "contacted"}'::jsonb WHERE id = 5091344029;`)
    return
  }

  console.log('  ✓ stage_overrides set for DCN DK')

  // Step 3: Backfill — update canonical_stage for existing DCN DK leads
  console.log('Step 3: Backfilling canonical_stage for DCN DK Doorgestuurd leads...')
  const { error: backfillErr, count } = await db
    .from('leads')
    .update({ canonical_stage: 'contacted' })
    .eq('board_id', 5091344029)
    .eq('current_status', 'Doorgestuurd')
    .select('*', { count: 'exact', head: true }) as any

  if (backfillErr) {
    console.error('Backfill failed:', backfillErr.message)
    console.log('\nRun this SQL manually:')
    console.log(`UPDATE leads SET canonical_stage = 'contacted' WHERE board_id = 5091344029 AND current_status = 'Doorgestuurd';`)
    return
  }

  // Step 4: Verify new distribution
  console.log('\nStep 4: Verifying new canonical_stage distribution...')
  const { data: allLeads } = await db
    .from('leads')
    .select('canonical_stage, contractor_id')
    .limit(5000)

  const { data: contractors } = await db.from('contractors').select('id, active')
  const activeIds = new Set((contractors ?? []).filter(c => c.active).map(c => c.id))

  const totalCounts: Record<string, number> = {}
  const activeCounts: Record<string, number> = {}

  for (const l of allLeads ?? []) {
    const s = l.canonical_stage ?? '(null)'
    totalCounts[s] = (totalCounts[s] ?? 0) + 1
    if (l.contractor_id && activeIds.has(l.contractor_id)) {
      activeCounts[s] = (activeCounts[s] ?? 0) + 1
    }
  }

  console.log('\nAll leads (first 1000 due to PostgREST cap):')
  for (const [s, c] of Object.entries(totalCounts).sort((a,b) => b[1]-a[1]))
    console.log(`  ${s}: ${c}`)

  // Count via direct filter query
  const { count: wonCount } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('canonical_stage', 'won') as any
  const { count: contactedCount } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('canonical_stage', 'contacted') as any
  const { count: dcnkContacted } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('board_id', 5091344029).eq('canonical_stage', 'contacted') as any
  const { count: dcnkWon } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('board_id', 5091344029).eq('canonical_stage', 'won') as any

  console.log('\nExact counts (count queries, bypass row limit):')
  console.log(`  won (all boards):       ${wonCount}`)
  console.log(`  contacted (all boards): ${contactedCount}`)
  console.log(`  DCN DK contacted:       ${dcnkContacted}`)
  console.log(`  DCN DK won (Akkoord):   ${dcnkWon}`)
}

main()
