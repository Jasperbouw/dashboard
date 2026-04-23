import { config } from 'dotenv'
config({ path: '.env.local' })

import { runAlerts } from '../lib/alerts/engine'
import { serverClient } from '../lib/supabase-server'
import type { AlertRow } from '../lib/alerts/types'
import { contractorLeaderboard, currentMonth } from '../lib/metrics'

function hr(label: string) {
  console.log('\n' + '═'.repeat(72))
  console.log(' ' + label)
  console.log('═'.repeat(72))
}

async function main() {
  console.log('\nAlerts engine — smoke test')
  console.log('Running all rules...')

  const result = await runAlerts()

  hr('Run summary')
  console.log(`  triggered : ${result.triggered}`)
  console.log(`  updated   : ${result.updated}`)
  console.log(`  resolved  : ${result.resolved}`)
  if (result.errors.length > 0) {
    console.log(`  errors    : ${result.errors.length}`)
    for (const e of result.errors) console.log(`    ✗ ${e}`)
  } else {
    console.log(`  errors    : 0`)
  }

  // Fetch active alerts grouped by type
  const db = serverClient()
  const { data: alerts } = await db
    .from('alerts')
    .select('*')
    .is('resolved_at', null)
    .order('severity')
    .order('triggered_at', { ascending: false })

  const rows = (alerts ?? []) as AlertRow[]

  hr('Active alerts by type')

  const byType = new Map<string, AlertRow[]>()
  for (const a of rows) {
    if (!byType.has(a.type)) byType.set(a.type, [])
    byType.get(a.type)!.push(a)
  }

  const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }
  const sorted = [...byType.entries()].sort((a, b) => {
    const sa = SEVERITY_ORDER[a[1][0].severity] ?? 99
    const sb = SEVERITY_ORDER[b[1][0].severity] ?? 99
    return sa - sb || a[0].localeCompare(b[0])
  })

  for (const [type, items] of sorted) {
    const sev = items[0].severity.toUpperCase().padEnd(9)
    console.log(`\n  [${sev}] ${type}  (${items.length} alert${items.length === 1 ? '' : 's'})`)
    for (const item of items.slice(0, 5)) {
      console.log(`    • ${item.title}`)
      console.log(`      ${item.body}`)
    }
    if (items.length > 5) console.log(`    … and ${items.length - 5} more`)
  }

  hr('Totals')
  const bySev = { critical: 0, warning: 0, info: 0 }
  for (const a of rows) bySev[a.severity]++
  console.log(`  CRITICAL : ${bySev.critical}`)
  console.log(`  WARNING  : ${bySev.warning}`)
  console.log(`  INFO     : ${bySev.info}`)
  console.log(`  TOTAL    : ${rows.length}`)

  hr('Backlog debt per contractor (new-stage leads >30d no activity)')
  const leaderboard = await contractorLeaderboard(currentMonth())
  console.log('name'.padEnd(40) + 'model'.padEnd(12) + 'backlogDebt')
  console.log('-'.repeat(64))
  for (const c of leaderboard.filter(c => c.backlogDebt > 0).sort((a, b) => b.backlogDebt - a.backlogDebt)) {
    console.log(
      c.name.slice(0, 39).padEnd(40) +
      (c.commission_model ?? '?').padEnd(12) +
      c.backlogDebt
    )
  }
  const totalBacklog = leaderboard.reduce((s, c) => s + c.backlogDebt, 0)
  if (totalBacklog === 0) console.log('  (none)')
  else console.log(`\n  Total backlog debt: ${totalBacklog} leads`)

  console.log('\n✓ Alerts smoke test complete')
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
