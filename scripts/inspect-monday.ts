import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync } from 'fs'
import { join } from 'path'
import { mondayQuery } from '../lib/monday'

const BOARDS_QUERY = `{
  boards(limit: 100, order_by: created_at) {
    id
    name
    board_kind
    groups {
      id
      title
    }
    columns {
      id
      title
      type
    }
  }
}`

interface Board {
  id: string
  name: string
  board_kind: string
  groups: { id: string; title: string }[]
  columns: { id: string; title: string; type: string }[]
}

async function main() {
  console.log('Fetching Monday.com board map...\n')

  const data = await mondayQuery<{ boards: Board[] }>(BOARDS_QUERY)
  const boards = data.boards

  const outPath = join(process.cwd(), 'monday-map.json')
  writeFileSync(outPath, JSON.stringify(boards, null, 2), 'utf8')
  console.log(`Wrote ${boards.length} boards to monday-map.json\n`)

  // Summary table
  const nameW = Math.min(50, Math.max(20, ...boards.map(b => b.name.length)))
  const header = `${'Board Name'.padEnd(nameW)}  ${'ID'.padEnd(16)}  ${'Kind'.padEnd(12)}  ${'Groups'.padEnd(8)}  Columns`
  console.log(header)
  console.log('─'.repeat(header.length))

  for (const b of boards) {
    const name = b.name.length > nameW ? b.name.slice(0, nameW - 1) + '…' : b.name
    console.log(
      `${name.padEnd(nameW)}  ${b.id.padEnd(16)}  ${b.board_kind.padEnd(12)}  ${String(b.groups.length).padEnd(8)}  ${b.columns.length}`
    )
  }
}

main().catch(err => {
  console.error('✗ Failed:', err.message)
  process.exit(1)
})
