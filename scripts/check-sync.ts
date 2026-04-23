// @ts-nocheck
import { config } from 'dotenv'
config({ path: '.env.local' })

import { serverClient } from '../lib/supabase-server'

const db = serverClient()

async function main() {
const [runs, statusChanges, weekLeads] = await Promise.all([
  db.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(3),
  db.from('lead_status_changes').select('*', { count: 'exact', head: true }),
  db.from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('monday_created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
])

console.log('\n─── Last 3 sync runs ───')
for (const r of runs.data ?? []) {
  console.log(`  ${r.started_at}  boards=${r.boards_synced}  items=${r.items_synced}  errors=${r.error_count}  alerts=${r.alerts_triggered ?? 0}`)
}

console.log('\n─── lead_status_changes rows ───')
console.log(' ', statusChanges.count)

console.log('\n─── Leads created this week ───')
console.log(' ', weekLeads.count)
}
main().catch(e => { console.error(e); process.exit(1) })
