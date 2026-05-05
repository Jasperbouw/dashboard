// @ts-nocheck
import { config } from 'dotenv'
config({ path: '.env.local' })
import { serverClient } from '../lib/supabase-server'
const db = serverClient()

async function main() {
  // 1. boards_config for all company boards — show contractor_id presence
  const { data: companyBoards } = await db
    .from('boards_config')
    .select('id, name, type, contractor_id')
    .eq('type', 'company')
    .order('name')
  console.log('\n─── Company boards in boards_config ───')
  for (const b of companyBoards ?? []) {
    console.log(`  [${b.id}] ${b.name}  contractor_id=${b.contractor_id ?? 'NULL'}`)
  }

  // 2. Per-board count of leads with/without contractor_id
  console.log('\n─── Leads with/without contractor_id, per company board ───')
  for (const b of companyBoards ?? []) {
    const [withCid, withoutCid, total] = await Promise.all([
      db.from('leads').select('id', { count: 'exact', head: true }).eq('board_id', b.id).not('contractor_id', 'is', null),
      db.from('leads').select('id', { count: 'exact', head: true }).eq('board_id', b.id).is('contractor_id', null),
      db.from('leads').select('id', { count: 'exact', head: true }).eq('board_id', b.id),
    ])
    if ((total.count ?? 0) > 0) {
      console.log(`  ${b.name}: total=${total.count}  with_cid=${withCid.count}  NULL_cid=${withoutCid.count}`)
    }
  }

  // 3. Detailed look at Bouwcombinatie Amsterdam's NULL leads
  const bca = (companyBoards ?? []).find(b => b.name.toLowerCase().includes('bouwcombinatie'))
  if (!bca) { console.log('\nBouwcombinatie Amsterdam not found in company boards'); return }
  console.log(`\n─── NULL contractor_id leads on [${bca.id}] ${bca.name} ───`)
  const { data: nullLeads } = await db
    .from('leads')
    .select('monday_item_id, current_status, canonical_stage, contractor_id, monday_created_at')
    .eq('board_id', bca.id)
    .is('contractor_id', null)
    .order('monday_created_at', { ascending: false })
  if (!nullLeads?.length) {
    console.log('  None found.')
  } else {
    console.log(`  ${nullLeads.length} leads with contractor_id=NULL:`)
    for (const l of nullLeads) {
      console.log(`    item=${l.monday_item_id}  status="${l.current_status}"  stage=${l.canonical_stage}  created=${l.monday_created_at?.slice(0,10)}`)
    }
  }

  // 4. Also check for leads on this board with a DIFFERENT contractor_id (sanity check)
  const { data: otherCid } = await db
    .from('leads')
    .select('monday_item_id, contractor_id, current_status')
    .eq('board_id', bca.id)
    .not('contractor_id', 'is', null)
    .neq('contractor_id', bca.contractor_id ?? '')
    .limit(5)
  if (otherCid?.length) {
    console.log(`\n  ⚠ Leads on this board with a DIFFERENT contractor_id (first 5):`)
    for (const l of otherCid) {
      console.log(`    item=${l.monday_item_id}  contractor_id=${l.contractor_id}  status="${l.current_status}"`)
    }
  }

  // 5. All boards: general boards that share board_id with a company board
  const { data: allBoards } = await db
    .from('boards_config')
    .select('id, name, type, contractor_id')
    .order('id')
  const boardIds = new Set((allBoards ?? []).map(b => b.id))
  const duplicates = (allBoards ?? []).filter(b =>
    (allBoards ?? []).some(b2 => b2.id === b.id && b2.name !== b.name)
  )
  if (duplicates.length) {
    console.log('\n─── ⚠ Boards with duplicate board IDs (different names) ───')
    for (const d of duplicates) console.log(`  [${d.id}] "${d.name}"  type=${d.type}  contractor_id=${d.contractor_id ?? 'NULL'}`)
  }

  // 6. Check for deleted/archived item count on Monday via leads table state
  // (proxy: leads with canonical_stage = NULL might be unknown statuses)
  const { data: nullStageLeads } = await db
    .from('leads')
    .select('current_status, monday_item_id', { count: 'exact' })
    .eq('board_id', bca.id)
    .is('canonical_stage', null)
    .limit(20)
  if (nullStageLeads?.length) {
    console.log(`\n─── Leads on Bouwcombinatie board with canonical_stage=NULL ───`)
    for (const l of nullStageLeads) {
      console.log(`    item=${l.monday_item_id}  status="${l.current_status}"`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
