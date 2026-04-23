// @ts-nocheck
import { serverClient } from '../lib/supabase-server'

async function main() {
  const db = serverClient()

  // Backfill: DCN DK Doorgestuurd → contacted
  console.log('Backfilling DCN DK Doorgestuurd leads...')
  const { error, count } = await db
    .from('leads')
    .update({ canonical_stage: 'contacted' })
    .eq('board_id', 5091344029)
    .eq('current_status', 'Doorgestuurd')

  if (error) { console.error('Backfill error:', error.message); process.exit(1) }
  console.log('  ✓ Updated (no count from update — verifying below)')

  // Verify via count queries
  const { count: wonTotal }      = await db.from('leads').select('*', { count: 'exact', head: true }).eq('canonical_stage', 'won')
  const { count: contactedTotal }= await db.from('leads').select('*', { count: 'exact', head: true }).eq('canonical_stage', 'contacted')
  const { count: dcnkContacted } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('board_id', 5091344029).eq('canonical_stage', 'contacted')
  const { count: dcnkWon }       = await db.from('leads').select('*', { count: 'exact', head: true }).eq('board_id', 5091344029).eq('canonical_stage', 'won')
  const { count: dcnkDoor }      = await db.from('leads').select('*', { count: 'exact', head: true }).eq('board_id', 5091344029).eq('current_status', 'Doorgestuurd')

  console.log('\n=== Post-backfill counts ===')
  console.log(`  won (all boards):            ${wonTotal}`)
  console.log(`  contacted (all boards):      ${contactedTotal}`)
  console.log(`  DCN DK canonical=contacted:  ${dcnkContacted}`)
  console.log(`  DCN DK canonical=won:        ${dcnkWon}`)
  console.log(`  DCN DK current=Doorgestuurd: ${dcnkDoor}  (should equal contacted)`)

  // Full stage distribution via direct count per stage
  console.log('\n=== Full stage distribution (exact counts) ===')
  const stages = ['new', 'contacted', 'inspection', 'quote_sent', 'won', 'deferred', 'lost']
  for (const s of stages) {
    const { count: c } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('canonical_stage', s)
    console.log(`  ${s}: ${c}`)
  }
  const { count: nullStage } = await db.from('leads').select('*', { count: 'exact', head: true }).is('canonical_stage', null)
  console.log(`  (null): ${nullStage}`)

  // Confirm stage_overrides was saved
  const { data: board } = await db.from('boards_config').select('id, name, stage_overrides').eq('id', 5091344029).single()
  console.log('\n=== DCN DK boards_config ===')
  console.log(`  stage_overrides: ${JSON.stringify(board?.stage_overrides)}`)
}

main()
