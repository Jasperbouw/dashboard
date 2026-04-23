import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Known label → contractor name mappings.
// Labels are the exact text values that appear in the Monday.com "Accounts"
// board_relation column. Contractor names must match the contractors table exactly.
const LABEL_MAP: Array<{ label: string; contractorName: string }> = [
  // Confirmed from Monday.com UI screenshot
  { label: 'AM Topdaken',             contractorName: 'AM Topdaken (archived)' },
  { label: 'DCN DD',                  contractorName: 'Dakcentrale Nederland (DD)' },
  { label: 'DCN DK',                  contractorName: 'Dakcentrale Nederland (DK)' },
  { label: 'Jongsma Dakbedekkingen',  contractorName: 'Jongsma Dakbedekkingen' },
  { label: 'Hollands Prefab',         contractorName: 'Hollands Prefab' },
  // Remaining contractors — labels assumed to match their Monday account name.
  // Update if the actual label differs once the board_relation is populated.
  { label: 'Bouwcombinatie Amsterdam', contractorName: 'Bouwcombinatie Amsterdam' },
  { label: 'Prefab Op Maat',           contractorName: 'Prefab Op Maat' },
  { label: 'T-Bouw',                   contractorName: 'T-Bouw' },
  { label: 'Flair',                    contractorName: 'Flair' },
  { label: 'Vastgoed Groep',           contractorName: 'Vastgoed Groep' },
  { label: 'Energie Collectief Oranje', contractorName: 'Energie Collectief Oranje' },
  { label: 'Bouwkostencalculatie',     contractorName: 'Bouwkostencalculatie' },
]

async function main() {
  const { data: contractors } = await db.from('contractors').select('id, name')
  if (!contractors) { console.error('Failed to fetch contractors'); process.exit(1) }

  const nameToId = new Map(contractors.map(c => [c.name, c.id]))

  const rows = []
  for (const { label, contractorName } of LABEL_MAP) {
    const contractorId = nameToId.get(contractorName)
    if (!contractorId) {
      console.warn(`  ⚠ No contractor found for name "${contractorName}" (label="${label}")`)
      continue
    }
    rows.push({ label, contractor_id: contractorId })
  }

  const { error } = await db
    .from('account_label_mapping')
    .upsert(rows, { onConflict: 'label' })

  if (error) { console.error('Upsert failed:', error.message); process.exit(1) }
  console.log(`✓ Seeded ${rows.length} label mappings`)

  // Print summary
  const { data: all } = await db
    .from('account_label_mapping')
    .select('label, contractors(name)')
    .order('label')
  for (const r of all ?? []) {
    const name = (r.contractors as any)?.name ?? 'NULL'
    console.log(`  "${r.label}" → ${name}`)
  }
}
main().catch(e => { console.error(e.message); process.exit(1) })
