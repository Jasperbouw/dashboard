// @ts-nocheck
import { serverClient } from '../lib/supabase-server'

async function main() {
  const db = serverClient()

  // 1. What boards/contractors have Doorgestuurd status?
  const { data: doorRows } = await db
    .from('leads')
    .select('board_id, contractor_id, current_status, canonical_stage')
    .eq('current_status', 'Doorgestuurd')

  const boardCounts: Record<number, number> = {}
  for (const r of doorRows ?? []) {
    boardCounts[r.board_id] = (boardCounts[r.board_id] ?? 0) + 1
  }
  console.log('Doorgestuurd by board_id:')
  for (const [b, c] of Object.entries(boardCounts).sort((a,b) => b[1]-a[1])) {
    console.log(`  board ${b}: ${c}`)
  }
  console.log('Total Doorgestuurd:', doorRows?.length)

  // 2. What boards exist in boards_config, and what type?
  const { data: boards } = await db.from('boards_config').select('id, name, niche, type, contractor_id')
  const boardMap = new Map(boards?.map(b => [b.id, b]) ?? [])
  console.log('\nboards_config (id, name, niche, type):')
  for (const b of boards ?? []) {
    console.log(`  ${b.id} | ${b.name} | ${b.niche} | ${b.type}`)
  }

  // 3. currentStageDistribution logic — active contractors
  const { data: contractors } = await db.from('contractors').select('id, name, niche, active')
  const active = contractors?.filter(c => c.active) ?? []
  const activeIds = active.map(c => c.id)
  console.log('\nActive contractors:', active.map(c => `${c.name}(${c.niche})`).join(', '))

  // 4. Won count with active contractor filter
  const { count: wonActive } = await db
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('canonical_stage', 'won')
    .in('contractor_id', activeIds)
  console.log('\nWon with active contractor filter:', wonActive)

  // 5. Check canonical_stage mapping — see the status_history or leads table columns
  const { data: sample } = await db.from('leads').select('current_status, canonical_stage').limit(5)
  console.log('\nSample rows:', sample)

  // 6. How is canonical_stage populated? Check if it's a DB column
  const { data: wonByContractor } = await db
    .from('leads')
    .select('contractor_id, current_status')
    .eq('canonical_stage', 'won')
  
  const cMap: Record<string, {statuses: Record<string, number>}> = {}
  for (const r of wonByContractor ?? []) {
    const cid = r.contractor_id ?? 'null'
    if (!cMap[cid]) cMap[cid] = { statuses: {} }
    cMap[cid].statuses[r.current_status ?? '(null)'] = (cMap[cid].statuses[r.current_status ?? '(null)'] ?? 0) + 1
  }
  const contractorById = new Map(contractors?.map(c => [c.id, c.name]) ?? [])
  console.log('\nWon leads by contractor:')
  for (const [cid, v] of Object.entries(cMap)) {
    const name = contractorById.get(cid) ?? cid
    const statusStr = Object.entries(v.statuses).map(([s,c]) => `${s}:${c}`).join(', ')
    console.log(`  ${name}: ${statusStr}`)
  }
}

main()
