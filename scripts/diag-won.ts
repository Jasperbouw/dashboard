// @ts-nocheck
import { serverClient } from '../lib/supabase-server'

async function main() {
  const db = serverClient()

  const { data, error } = await db
    .from('leads')
    .select('current_status, canonical_stage')
    .eq('canonical_stage', 'won')

  if (error) { console.error(error); process.exit(1) }

  const grouped: Record<string, number> = {}
  for (const row of data ?? []) {
    const key = row.current_status ?? '(null)'
    grouped[key] = (grouped[key] ?? 0) + 1
  }

  console.log('Won leads by current_status:')
  for (const [s, c] of Object.entries(grouped).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${s}: ${c}`)
  }
  console.log('Total won:', data?.length)

  // Total leads count
  const { count: totalCount } = await db.from('leads').select('*', { count: 'exact', head: true })
  console.log('\nTotal leads in DB:', totalCount)

  // Won with NULL contractor_id
  const { count: wonNullCount } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('canonical_stage', 'won').is('contractor_id', null)
  console.log('Won with NULL contractor_id:', wonNullCount)

  // All stage distribution (no filter)
  const { data: allStages } = await db.from('leads').select('canonical_stage')
  const stageMap: Record<string, number> = {}
  for (const r of allStages ?? []) {
    const s = r.canonical_stage ?? '(null)'
    stageMap[s] = (stageMap[s] ?? 0) + 1
  }
  console.log('\nAll stages (no contractor filter):')
  for (const [s, c] of Object.entries(stageMap).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${s}: ${c}`)
  }

  // Niche distribution for won leads
  const { data: contractors } = await db.from('contractors').select('id, niche, name')
  const nicheById = new Map(contractors?.map(c => [c.id, c.niche]) ?? [])
  const nicheWon: Record<string, number> = {}
  for (const r of data ?? []) {
    const niche = r.contractor_id ? (nicheById.get(r.contractor_id) ?? 'unknown') : 'no_contractor'
    nicheWon[niche] = (nicheWon[niche] ?? 0) + 1
  }
  console.log('\nWon leads by niche:')
  for (const [n, c] of Object.entries(nicheWon).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${n}: ${c}`)
  }
}

main()
