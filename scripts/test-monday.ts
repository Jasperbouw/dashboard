import { config } from 'dotenv'
config({ path: '.env.local' })
import { mondayQuery } from '../lib/monday'

const ME_QUERY = `{ me { id name email } }`

interface MeResponse {
  me: { id: number; name: string; email: string }
}

async function main() {
  console.log('Testing Monday.com API connection...\n')

  const data = await mondayQuery<MeResponse>(ME_QUERY)

  console.log('✓ Connected successfully')
  console.log(`  ID:    ${data.me.id}`)
  console.log(`  Name:  ${data.me.name}`)
  console.log(`  Email: ${data.me.email}`)
}

main().catch(err => {
  console.error('✗ Connection failed:', err.message)
  process.exit(1)
})
