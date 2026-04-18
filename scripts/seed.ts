import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ── Contractor definitions ────────────────────────────────────────────────────

const CONTRACTORS = [
  { name: 'Jongsma Dakbedekkingen',     niche: 'daken',    target_monthly_leads: 30,  target_monthly_revenue: 25000,  target_commission: 1500 },
  { name: 'Dakcentrale Nederland (DD)', niche: 'daken',    target_monthly_leads: 140, target_monthly_revenue: 40000,  target_commission: 2000 },
  { name: 'Dakcentrale Nederland (DK)', niche: 'dakkapel', target_monthly_leads: null, target_monthly_revenue: 40000, target_commission: 2000 },
  { name: 'Hollands Prefab',            niche: 'bouw',     target_monthly_leads: 100, target_monthly_revenue: 200000, target_commission: 10000 },
  { name: 'Bouwcombinatie Amsterdam',   niche: 'bouw',     target_monthly_leads: 50,  target_monthly_revenue: 40000,  target_commission: 2000 },
  { name: 'Prefab Op Maat',             niche: 'bouw',     target_monthly_leads: 40,  target_monthly_revenue: 40000,  target_commission: 2000 },
  { name: 'T-Bouw',                     niche: 'bouw',     target_monthly_leads: 20,  target_monthly_revenue: 40000,  target_commission: 2000 },
  { name: 'Flair',                      niche: 'bouw',     target_monthly_leads: null, target_monthly_revenue: null,  target_commission: null },
  { name: 'Vastgoed Groep',             niche: 'bouw',     target_monthly_leads: 30,  target_monthly_revenue: 50000,  target_commission: 2500 },
  { name: 'Energie Collectief Oranje',  niche: 'extras',   target_monthly_leads: null, target_monthly_revenue: 1000,  target_commission: 1000 },
  { name: 'Bouwkostencalculatie',       niche: 'extras',   target_monthly_leads: null, target_monthly_revenue: null,  target_commission: null },
] as const

// ── Active board definitions (column_map per board) ───────────────────────────

type BoardDef = {
  id: number
  name: string
  type: 'general' | 'company' | 'projects'
  niche: string | null
  contractor_key: string | null  // matches CONTRACTORS name
  column_map: Record<string, string>
  active: true
}

const ACTIVE_BOARDS: BoardDef[] = [
  // General leads
  {
    id: 5091706227,
    name: 'Bouw Leads',
    type: 'general',
    niche: 'bouw',
    contractor_key: null,
    active: true,
    column_map: {
      campaign_tag: 'text_mm0ghcar',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      urgentie:     'long_text_mktfh12b',
      dienst:       'text_mkskv446',
      m2:           'text_mkskn3bq',
      tekening:     'text_mkskb49d',
      postcode:     'text_mksk8j3',
      straat:       'text_mkskpdsk',
      opmerkingen:  'long_text4',
    },
  },
  // Projects board
  {
    id: 5091342542,
    name: 'Client Projects',
    type: 'projects',
    niche: null,
    contractor_key: null,
    active: true,
    column_map: {
      aanneemsom:       'text_mm0dpc7',
      betaal_status:    'color_mm0dgzza',
      commissie:        'numeric_mm1mpd42',
      commissie_status: 'color_mm0ddwrj',
      contract:         'boolean_mm0drnnq',
      timeline:         'project_timeline',
      status:           'project_status',
    },
  },
  // Daken
  {
    id: 5015792750,
    name: 'Jongsma Dakbedekkingen',
    type: 'company',
    niche: 'daken',
    contractor_key: 'Jongsma Dakbedekkingen',
    active: true,
    column_map: {
      campaign_tag: 'text_mkskqqft',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      urgentie:     'long_text_mktfh12b',
      dienst:       'text_mkskv446',
      m2:           'text_mkskn3bq',
      tekening:     'text_mkskb49d',
      postcode:     'text_mksk8j3',
      straat:       'text_mkskpdsk',
      opmerkingen:  'long_text4',
    },
  },
  {
    id: 5087925675,
    name: 'Dakcentrale Nederland (DD)',
    type: 'company',
    niche: 'daken',
    contractor_key: 'Dakcentrale Nederland (DD)',
    active: true,
    column_map: {
      campaign_tag: 'text_mm286ary',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      urgentie:     'long_text_mktfh12b',
      dienst:       'text_mkskv446',
      m2:           'text_mkskn3bq',
      tekening:     'text_mkskb49d',
      postcode:     'text_mksk8j3',
      straat:       'text_mkskpdsk',
      opmerkingen:  'long_text4',
    },
  },
  // Dakkapel
  {
    id: 5091344029,
    name: 'Dakcentrale Nederland (DK)',
    type: 'company',
    niche: 'dakkapel',
    contractor_key: 'Dakcentrale Nederland (DK)',
    active: true,
    column_map: {
      phone:       'contact_phone',
      email:       'text_mksk3arq',
      status:      'color_mkskgdv2',
      dienst:      'text_mkskv446',
      m2:          'text_mkskn3bq',
      tekening:    'text_mkskb49d',
      postcode:    'text_mksk8j3',
      straat:      'text_mkskpdsk',
      opmerkingen: 'long_text4',
    },
  },
  // Bouw
  {
    id: 5091704359,
    name: 'Hollands Prefab',
    type: 'company',
    niche: 'bouw',
    contractor_key: 'Hollands Prefab',
    active: true,
    column_map: {
      campaign_tag: 'text_mm0gvtwe',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      follow_up:    'date_mm19a3g2',
      urgentie:     'long_text_mktfh12b',
      dienst:       'text_mkskv446',
      m2:           'text_mkskn3bq',
      tekening:     'text_mkskb49d',
      postcode:     'text_mksk8j3',
      straat:       'text_mkskpdsk',
      opmerkingen:  'long_text4',
    },
  },
  {
    id: 5093568631,
    name: 'Bouwcombinatie Amsterdam',
    type: 'company',
    niche: 'bouw',
    contractor_key: 'Bouwcombinatie Amsterdam',
    active: true,
    column_map: {
      campaign_tag: 'text_mm28xcn1',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      follow_up:    'date_mm1zbd26',
      urgentie:     'long_text_mktfh12b',
      dienst:       'text_mkskv446',
      m2:           'text_mkskn3bq',
      tekening:     'text_mkskb49d',
      postcode:     'text_mksk8j3',
      straat:       'text_mkskpdsk',
      opmerkingen:  'long_text4',
    },
  },
  {
    id: 5092569117,
    name: 'Prefab Op Maat',
    type: 'company',
    niche: 'bouw',
    contractor_key: 'Prefab Op Maat',
    active: true,
    column_map: {
      campaign_tag: 'text_mm12g9jx',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      urgentie:     'long_text_mktfh12b',
      dienst:       'text_mkskv446',
      m2:           'text_mkskn3bq',
      tekening:     'text_mkskb49d',
      postcode:     'text_mksk8j3',
      straat:       'text_mkskpdsk',
      opmerkingen:  'long_text4',
    },
  },
  {
    id: 5094253751,
    name: 'T-Bouw',
    type: 'company',
    niche: 'bouw',
    contractor_key: 'T-Bouw',
    active: true,
    column_map: {
      campaign_tag: 'text_mm28975r',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      urgentie:     'long_text_mktfh12b',
      dienst:       'text_mkskv446',
      m2:           'text_mkskn3bq',
      tekening:     'text_mkskb49d',
      postcode:     'text_mksk8j3',
      straat:       'text_mkskpdsk',
      opmerkingen:  'long_text4',
    },
  },
  {
    id: 5093896251,
    name: 'Flair',
    type: 'company',
    niche: 'bouw',
    contractor_key: 'Flair',
    active: true,
    column_map: {
      campaign_tag: 'text_mm28xa9m',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      urgentie:     'long_text_mktfh12b',
      dienst:       'text_mkskv446',
      m2:           'text_mkskn3bq',
      tekening:     'text_mkskb49d',
      postcode:     'text_mksk8j3',
      straat:       'text_mkskpdsk',
      opmerkingen:  'long_text4',
    },
  },
  {
    id: 5093939578,
    name: 'Vastgoed Groep',
    type: 'company',
    niche: 'bouw',
    contractor_key: 'Vastgoed Groep',
    active: true,
    column_map: {
      campaign_tag: 'text_mm2820vb',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      urgentie:     'long_text_mktfh12b',
      dienst:       'text_mkskv446',
      m2:           'text_mkskn3bq',
      tekening:     'text_mkskb49d',
      postcode:     'text_mksk8j3',
      straat:       'text_mkskpdsk',
      opmerkingen:  'long_text4',
    },
  },
  // Extras
  {
    id: 5093454924,
    name: 'Energie Collectief Oranje',
    type: 'company',
    niche: 'extras',
    contractor_key: 'Energie Collectief Oranje',
    active: true,
    column_map: {
      campaign_tag: 'text_mm22psrv',
      phone:        'contact_phone',
      email:        'text_mksk3arq',
      status:       'color_mkskgdv2',
      opmerkingen:  'long_text4',
    },
  },
  {
    id: 5093516990,
    name: 'Bouwkostencalculatie',
    type: 'company',
    niche: 'extras',
    contractor_key: 'Bouwkostencalculatie',
    active: true,
    column_map: {
      phone:       'contact_phone',
      email:       'text_mksk3arq',
      status:      'color_mkskgdv2',
      urgentie:    'long_text_mktfh12b',
      dienst:      'text_mkskv446',
      tekening:    'text_mkskb49d',
    },
  },
]

// Inactive boards — tracked but never synced
const INACTIVE_BOARD_IDS: Array<{ id: number; name: string }> = [
  { id: 5094087853, name: 'Vloeren leads' },
  { id: 5094044110, name: 'Aannemer Noorden/Oosten' },
  { id: 5091343873, name: 'Dakcentrale Nederland (old)' },
  { id: 5091344340, name: 'BK - MO' },
  { id: 5091344307, name: 'Rotterdamse BK' },
  { id: 5091639459, name: 'Schilder Bedrijven' },
  { id: 5091629811, name: 'Bouwbedrijf Gemmink' },
  { id: 5091629639, name: 'Aannemer X' },
  { id: 5091346283, name: 'Vloeren leads (2)' },
  { id: 5091346251, name: 'Vloeren leads (3)' },
  { id: 5091346155, name: 'Vloeren Bedrijven' },
  { id: 5091346132, name: 'Vloeren Bedrijven (2)' },
  { id: 5091346093, name: 'Airco Bedrijven' },
  { id: 5091346015, name: 'Airco Bedrijven (2)' },
  { id: 5091345789, name: 'LT Elektro' },
  { id: 5091345633, name: 'Airco Leads' },
  { id: 5091345317, name: 'Airco Leads (2)' },
  { id: 5091343156, name: 'Quotes & Invoices' },
  { id: 5091343154, name: 'Accounts' },
  { id: 5091342540, name: 'Quotes & Invoices (2)' },
  { id: 5089167733, name: 'Aannemers' },
  { id: 5087427206, name: 'EKO Group' },
  { id: 5081902452, name: 'EKO Group B.V.' },
  { id: 5073946543, name: 'Quotes & Invoices (3)' },
  { id: 5062159390, name: 'AM Topdaken' },
  { id: 5049332167, name: 'Weekly Totals' },
  { id: 5049323798, name: 'Ledger' },
  { id: 5049140185, name: 'Buyers' },
  { id: 5022676231, name: 'Dakdekker Leads' },
  { id: 5015842998, name: 'Ermir' },
  { id: 5015792455, name: 'Dakdekker Leads (old)' },
  { id: 5015588898, name: 'AC - Twente' },
  { id: 5015588483, name: 'van Amelsvoort' },
  { id: 5015392608, name: 'Quotes & Invoices (4)' },
  { id: 2037637603, name: 'Quotes & Invoices (5)' },
  { id: 2037637602, name: 'DD Leads' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Check existing state
  const { count: existingContractors } = await db
    .from('contractors').select('*', { count: 'exact', head: true })
  const { count: existingBoards } = await db
    .from('boards_config').select('*', { count: 'exact', head: true })

  // ── Contractors ──────────────────────────────────────────────────────────
  console.log('Seeding contractors...')
  let contractorIdMap: Record<string, string> = {}

  if ((existingContractors ?? 0) > 0) {
    console.log(`  ↩ ${existingContractors} contractors already exist — loading IDs`)
    const { data: existing } = await db.from('contractors').select('id, name')
    for (const c of existing ?? []) contractorIdMap[c.name] = c.id
  } else {
    const { data: inserted, error: cErr } = await db
      .from('contractors')
      .insert(CONTRACTORS.map(c => ({ ...c, active: true })))
      .select('id, name')
    if (cErr) { console.error('Contractors error:', cErr.message); process.exit(1) }
    for (const c of inserted ?? []) contractorIdMap[c.name] = c.id
    console.log(`  ✓ ${inserted?.length} contractors inserted`)
  }

  // ── Boards ───────────────────────────────────────────────────────────────
  console.log('\nSeeding boards_config...')

  if ((existingBoards ?? 0) > 0) {
    console.log(`  ↩ ${existingBoards} boards already exist — skipping`)
  } else {
    const activeBoardRows = ACTIVE_BOARDS.map(b => ({
      id:            b.id,
      name:          b.name,
      type:          b.type,
      niche:         b.niche,
      contractor_id: b.contractor_key ? contractorIdMap[b.contractor_key] ?? null : null,
      column_map:    b.column_map,
      active:        true,
    }))

    const { error: abErr } = await db.from('boards_config').insert(activeBoardRows)
    if (abErr) { console.error('Active boards error:', abErr.message); process.exit(1) }
    console.log(`  ✓ ${activeBoardRows.length} active boards inserted`)

    const inactiveBoardRows = INACTIVE_BOARD_IDS.map(b => ({
      id:            b.id,
      name:          b.name,
      type:          'company' as const,
      niche:         null,
      contractor_id: null,
      column_map:    {},
      active:        false,
    }))

    const { error: ibErr } = await db.from('boards_config').insert(inactiveBoardRows)
    if (ibErr) { console.error('Inactive boards error:', ibErr.message); process.exit(1) }
    console.log(`  ✓ ${inactiveBoardRows.length} inactive boards inserted`)
  }

  // Verify
  const { count: cCount } = await db.from('contractors').select('*', { count: 'exact', head: true })
  const { count: bCount } = await db.from('boards_config').select('*', { count: 'exact', head: true })
  const { count: bActive } = await db.from('boards_config').select('*', { count: 'exact', head: true }).eq('active', true)

  console.log(`\n✓ Done. DB state: ${cCount} contractors, ${bCount} boards (${bActive} active)`)
}

main().catch(err => { console.error('Seed failed:', err.message); process.exit(1) })
