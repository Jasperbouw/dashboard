// @ts-nocheck
import { serverClient } from '../lib/supabase-server'

async function main() {
  const db = serverClient()

  // Q1 — won by current_status
  console.log('=== Q1: Won leads by current_status ===')
  const { data: q1 } = await db
    .from('leads')
    .select('current_status, canonical_stage')
    .eq('canonical_stage', 'won')
    .limit(5000)
  const q1map: Record<string, number> = {}
  for (const r of q1 ?? []) {
    const k = r.current_status ?? '(null)'
    q1map[k] = (q1map[k] ?? 0) + 1
  }
  for (const [s, c] of Object.entries(q1map).sort((a,b) => b[1]-a[1]))
    console.log(`  ${s}: ${c}`)
  console.log(`  TOTAL: ${q1?.length}`)

  // Q2 — won by contractor (name, active) and current_status
  console.log('\n=== Q2: Won leads by contractor + status ===')
  const { data: q2leads } = await db
    .from('leads')
    .select('contractor_id, current_status, board_id')
    .eq('canonical_stage', 'won')
    .limit(5000)
  const { data: contractors } = await db
    .from('contractors')
    .select('id, name, active')
  const cMap = new Map(contractors?.map(c => [c.id, c]) ?? [])
  const q2map: Record<string, { active: boolean | null; count: number }> = {}
  for (const r of q2leads ?? []) {
    const c = r.contractor_id ? cMap.get(r.contractor_id) : null
    const key = `${c?.name ?? 'no_contractor'} | ${r.current_status}`
    if (!q2map[key]) q2map[key] = { active: c?.active ?? null, count: 0 }
    q2map[key].count++
  }
  for (const [k, v] of Object.entries(q2map).sort((a,b) => b[1].count-a[1].count))
    console.log(`  [active=${v.active}] ${k}: ${v.count}`)

  // Q3 — duplicate monday_item_id
  console.log('\n=== Q3: Duplicate monday_item_id (sample) ===')
  const { data: allIds } = await db
    .from('leads')
    .select('monday_item_id')
    .limit(5000)
  const idCounts: Record<string, number> = {}
  for (const r of allIds ?? []) {
    const k = String(r.monday_item_id)
    idCounts[k] = (idCounts[k] ?? 0) + 1
  }
  const dupes = Object.entries(idCounts).filter(([,c]) => c > 1)
  console.log(`  Duplicate monday_item_ids: ${dupes.length}`)
  if (dupes.length > 0) {
    console.log('  Sample dupes:', dupes.slice(0, 5).map(([id, c]) => `${id} (x${c})`).join(', '))
  }

  // Q4 — won by contractors.active
  console.log('\n=== Q4: Won leads by contractor.active ===')
  const q4map: Record<string, number> = { 'true': 0, 'false': 0, 'null(no_contractor)': 0 }
  for (const r of q2leads ?? []) {
    const c = r.contractor_id ? cMap.get(r.contractor_id) : null
    const key = c == null ? 'null(no_contractor)' : String(c.active)
    q4map[key] = (q4map[key] ?? 0) + 1
  }
  for (const [k, v] of Object.entries(q4map))
    console.log(`  active=${k}: ${v}`)

  // Extra: what canonical_stage mapping hits 'won' — check canonical_stage_map in code
  console.log('\n=== EXTRA: all canonical_stages in DB ===')
  const { data: allLeads } = await db
    .from('leads')
    .select('canonical_stage')
    .limit(5000)
  const stageMap: Record<string, number> = {}
  for (const r of allLeads ?? []) {
    const s = r.canonical_stage ?? '(null)'
    stageMap[s] = (stageMap[s] ?? 0) + 1
  }
  for (const [s, c] of Object.entries(stageMap).sort((a,b) => b[1]-a[1]))
    console.log(`  ${s}: ${c}`)
}

main()
