import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  // Sample open quotes
  const { data: quotes } = await db.from('leads')
    .select('contact_name, canonical_stage, quote_amount, board_id, monday_item_id, monday_created_at, raw_column_values')
    .eq('canonical_stage', 'quote_sent')
    .limit(3)
  console.log('Open quotes sample:')
  quotes?.forEach(q => {
    console.log(` contact=${q.contact_name} quote_amount=${q.quote_amount} board=${q.board_id} item=${q.monday_item_id}`)
    console.log(` raw_keys=${Object.keys(q.raw_column_values ?? {}).join(', ')}`)
  })

  // Sample lost leads for reason
  const { data: lost } = await db.from('leads')
    .select('contact_name, raw_column_values, current_status')
    .eq('canonical_stage', 'lost')
    .limit(3)
  console.log('\nLost leads sample:')
  lost?.forEach(l => {
    console.log(` contact=${l.contact_name} status=${l.current_status}`)
    console.log(` raw_values=${JSON.stringify(l.raw_column_values).slice(0, 200)}`)
  })
}
main().catch(console.error)
