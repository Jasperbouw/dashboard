import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  // Test the connection by checking if table already exists
  const { error } = await db
    .from('contractor_contracts')
    .select('id')
    .limit(1)

  if (!error) {
    console.log('Table contractor_contracts already exists — nothing to do.')
    return
  }

  if (error.code !== 'PGRST116' && !error.message.includes('does not exist') && !error.message.includes('relation')) {
    // Unexpected error
    console.log('Checking table status. Error code:', error.code, error.message)
  }

  console.log('Table does not exist yet. Run the following SQL in the Supabase SQL editor:')
  console.log('\n' + readFileSync(join(process.cwd(), 'supabase/migrations/013_contractor_contracts.sql'), 'utf-8'))
}

main().catch(console.error)
