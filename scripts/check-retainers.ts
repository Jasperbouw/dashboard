import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  const { data: retainers } = await db.from('contractors')
    .select('id, name, commission_model, monthly_retainer, retainer_billing, relationship_status')
    .eq('commission_model', 'retainer')
  console.log('Retainer contractors:')
  console.log(JSON.stringify(retainers, null, 2))

  // Sample leads columns for quote data
  const { data: sampleLead } = await db.from('leads')
    .select('*')
    .limit(1)
    .single()
  console.log('\nLead columns:', Object.keys(sampleLead ?? {}))
}
main().catch(console.error)
