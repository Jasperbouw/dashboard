import { config } from 'dotenv'
config({ path: '.env.local' })
import { mondayQuery } from '../lib/monday'

async function main() {
  // Use the actual Client Projects board ID from boards_config
  const PROJECTS_BOARD_ID = 5091342542

  // First, let's check what boards_config says the ID is
  // Actually let's just query the board directly
  const data = await mondayQuery<any>(`{
    boards(ids: [${PROJECTS_BOARD_ID}]) {
      columns { id title type }
      groups { id title }
      items_page(limit: 30) {
        items {
          id name state
          group { id title }
          column_values { id type text value }
        }
      }
    }
  }`)

  console.log('Board columns:')
  for (const c of data.boards?.[0]?.columns ?? []) {
    if (c.type === 'board-relation' || c.type === 'connect_boards') {
      console.log(`  *** RELATION: id=${c.id} title="${c.title}" type=${c.type}`)
    } else {
      console.log(`  id=${c.id} title="${c.title}" type=${c.type}`)
    }
  }

  const items = data.boards?.[0]?.items_page?.items ?? []
  console.log(`\nAll ${items.length} project items — ALL non-empty column values:`)
  for (const item of items) {
    const nonEmpty = item.column_values.filter((c: any) =>
      c.text && c.text.trim() !== ''
    )
    if (nonEmpty.length > 0) {
      console.log(`\n  Item ${item.id} "${item.name.slice(0,35)}"`)
      for (const cv of nonEmpty) {
        console.log(`    col[${cv.id}] type=${cv.type} text="${cv.text}" value=${String(cv.value ?? '').slice(0,80)}`)
      }
    }
  }
}
main().catch(e => { console.error(e.message); process.exit(1) })
