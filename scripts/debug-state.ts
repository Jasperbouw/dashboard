import { config } from 'dotenv'
config({ path: '.env.local' })
import { mondayQuery } from '../lib/monday'

async function main() {
  // Check state field on DK board items
  const data = await mondayQuery<any>(`{
    boards(ids: [5091344029]) {
      items_page(limit: 20) {
        items { id name state }
      }
    }
  }`)
  const items = data.boards?.[0]?.items_page?.items ?? []
  const stateCounts: Record<string, number> = {}
  for (const i of items) {
    const s = i.state ?? 'undefined'
    stateCounts[s] = (stateCounts[s] ?? 0) + 1
  }
  console.log('DK board — first 20 items state distribution:', stateCounts)
  console.log('Sample:', items.slice(0,5).map((i: any) => ({ id: i.id, name: i.name.slice(0,20), state: i.state })))

  // Check Accounts board items with their names
  const acc = await mondayQuery<any>(`{
    boards(ids: [5091343154]) {
      items_page(limit: 50) {
        items { id name state }
      }
    }
  }`)
  const accItems = acc.boards?.[0]?.items_page?.items ?? []
  console.log('\nAccounts board items:')
  for (const i of accItems) {
    console.log(`  ${i.id}  state=${i.state}  name="${i.name}"`)
  }
}
main().catch(e => { console.error(e.message); process.exit(1) })
