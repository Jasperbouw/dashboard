import { config } from 'dotenv'
config({ path: '.env.local' })

import { syncAllBoards } from '../lib/monday-sync'

async function main() {
  console.log('Starting Monday sync...\n')
  const start = Date.now()

  const result = await syncAllBoards()
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\nSync complete in ${elapsed}s`)
  console.log(`  Boards synced: ${result.boardsSynced}`)
  console.log(`  Items synced:  ${result.itemsSynced}`)
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`)
    for (const e of result.errors) console.log(`    Board ${e.boardId}: ${e.error}`)
  }
}

main().catch(err => { console.error('Sync failed:', err.message); process.exit(1) })
