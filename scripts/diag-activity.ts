// @ts-nocheck
import { serverClient } from '../lib/supabase-server'

async function main() {
  const db = serverClient()

  // a) lead_updates schema + sample
  console.log('=== a) lead_updates — columns via sample row ===')
  const { data: sampleUpdate } = await db
    .from('lead_updates')
    .select('*')
    .limit(1)
  if (sampleUpdate?.[0]) {
    console.log('Fields:', Object.keys(sampleUpdate[0]).join(', '))
    console.log('Sample:', JSON.stringify(sampleUpdate[0], null, 2))
  } else {
    console.log('No rows or table does not exist')
  }

  // Count total rows
  const { count: updateCount } = await db
    .from('lead_updates')
    .select('*', { count: 'exact', head: true })
  console.log('Total lead_updates rows:', updateCount)

  // b) lead_status_changes schema + sample
  console.log('\n=== b) lead_status_changes — columns via sample row ===')
  const { data: sampleChange } = await db
    .from('lead_status_changes')
    .select('*')
    .limit(1)
  if (sampleChange?.[0]) {
    console.log('Fields:', Object.keys(sampleChange[0]).join(', '))
    console.log('Sample:', JSON.stringify(sampleChange[0], null, 2))
  } else {
    console.log('No rows or table does not exist')
  }

  const { count: changeCount } = await db
    .from('lead_status_changes')
    .select('*', { count: 'exact', head: true })
  console.log('Total lead_status_changes rows:', changeCount)

  // c) Hollands Prefab — find contractor_id
  const { data: hp } = await db
    .from('contractors')
    .select('id, name')
    .ilike('name', '%Hollands Prefab%')
    .single()
  console.log('\n=== c) Hollands Prefab contractor ===')
  console.log('id:', hp?.id, 'name:', hp?.name)

  if (hp?.id) {
    // Get their lead IDs
    const { data: hpLeads } = await db
      .from('leads')
      .select('id')
      .eq('contractor_id', hp.id)
      .limit(500)
    const hpLeadIds = (hpLeads ?? []).map(l => l.id)
    console.log('Lead count:', hpLeadIds.length)

    if (hpLeadIds.length > 0) {
      // Last 20 lead_updates for HP leads
      console.log('\n--- Last 20 lead_updates for Hollands Prefab ---')
      const { data: updates } = await db
        .from('lead_updates')
        .select('created_at, creator_name, update_type, body')
        .in('lead_id', hpLeadIds)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (updates?.length) {
        for (const u of updates) {
          console.log(`  ${u.created_at?.slice(0,16)} | ${u.creator_name ?? '(null)'} | ${u.update_type ?? ''} | ${String(u.body ?? '').slice(0, 60)}`)
        }
      } else {
        console.log('  No lead_updates rows found for HP leads')
        // check if lead_updates even has creator_name column
        const { data: anyUpdate } = await db
          .from('lead_updates')
          .select('*')
          .in('lead_id', hpLeadIds.slice(0, 10))
          .limit(5)
        if (anyUpdate?.length) {
          console.log('  Sample update (all fields):', JSON.stringify(anyUpdate[0]))
        }
      }

      // Distinct creator_names across ALL lead_updates for HP
      console.log('\n--- All distinct creator_names for Hollands Prefab ---')
      const { data: allUpdates } = await db
        .from('lead_updates')
        .select('creator_name')
        .in('lead_id', hpLeadIds)
        .limit(5000)
      const names: Record<string, number> = {}
      for (const u of allUpdates ?? []) {
        const n = u.creator_name ?? '(null)'
        names[n] = (names[n] ?? 0) + 1
      }
      for (const [n, c] of Object.entries(names).sort((a,b) => b[1]-a[1]))
        console.log(`  ${n}: ${c}`)

      // Last 20 lead_status_changes for HP leads
      console.log('\n--- Last 20 lead_status_changes for Hollands Prefab ---')
      const { data: changes } = await db
        .from('lead_status_changes')
        .select('*')
        .in('lead_id', hpLeadIds)
        .order('changed_at', { ascending: false })
        .limit(20)
      if (changes?.length) {
        console.log('  Fields:', Object.keys(changes[0]).join(', '))
        for (const c of changes) {
          console.log(`  ${c.changed_at?.slice(0,16)} | from: ${c.from_status} → ${c.to_status}`)
        }
      } else {
        console.log('  No lead_status_changes for HP leads')
      }
    }
  }

  // Global distinct creator_names across ALL lead_updates
  console.log('\n=== GLOBAL: distinct creator_names in lead_updates ===')
  const { data: allNames } = await db
    .from('lead_updates')
    .select('creator_name')
    .limit(5000)
  const globalNames: Record<string, number> = {}
  for (const u of allNames ?? []) {
    const n = u.creator_name ?? '(null)'
    globalNames[n] = (globalNames[n] ?? 0) + 1
  }
  for (const [n, c] of Object.entries(globalNames).sort((a,b) => b[1]-a[1]))
    console.log(`  ${n}: ${c}`)
}

main()
