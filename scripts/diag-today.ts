// @ts-nocheck
import { config } from 'dotenv'
config({ path: '.env.local' })

import { serverClient } from '../lib/supabase-server'

const db = serverClient()

function hr(label: string) {
  console.log('\n' + '═'.repeat(72))
  console.log(' ' + label)
  console.log('═'.repeat(72))
}

function pct(n: number, d: number) {
  if (!d) return '—'
  return (Math.round((n / d) * 1000) / 10) + '%'
}

async function main() {
  // Week window: Monday 00:00 → now
  const now = new Date()
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1   // 0=Mon … 6=Sun
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dow)
  weekStart.setHours(0, 0, 0, 0)
  const weekStartIso = weekStart.toISOString()
  const weekEndIso   = now.toISOString()

  console.log(`\nDiagnostic — Today page accuracy audit`)
  console.log(`Week window: ${weekStart.toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'short' })} → now`)

  // ── 1. LEADS DEZE WEEK — board_type breakdown ─────────────────────────────
  hr('1. Leads deze week — board_type breakdown')

  const { data: allLeads } = await db
    .from('leads')
    .select('id, board_type, contractor_id, canonical_stage, niche')
    .gte('monday_created_at', weekStartIso)
    .lte('monday_created_at', weekEndIso)

  const total        = allLeads?.length ?? 0
  const onGeneral    = allLeads?.filter(l => l.board_type === 'general') ?? []
  const onCompany    = allLeads?.filter(l => l.board_type === 'company' && l.contractor_id) ?? []
  const noContractor = allLeads?.filter(l => !l.contractor_id) ?? []

  console.log(`  Total leads this week (all boards)  : ${total}`)
  console.log(`  board_type = 'company' w/ contractor: ${onCompany.length}`)
  console.log(`  board_type = 'general'               : ${onGeneral.length}`)
  console.log(`  contractor_id IS NULL                : ${noContractor.length}`)

  // General board breakdown by canonical_stage
  const genByStage: Record<string, number> = {}
  for (const l of onGeneral) {
    const s = l.canonical_stage ?? 'null'
    genByStage[s] = (genByStage[s] ?? 0) + 1
  }
  console.log(`\n  General board by canonical_stage:`)
  for (const [s, n] of Object.entries(genByStage).sort((a,b) => b[1]-a[1])) {
    console.log(`    ${s.padEnd(20)} ${n}`)
  }

  // Company board by niche
  const compByNiche: Record<string, number> = {}
  for (const l of onCompany) {
    const n = l.niche ?? 'onbekend'
    compByNiche[n] = (compByNiche[n] ?? 0) + 1
  }
  console.log(`\n  Company board by niche:`)
  for (const [n, cnt] of Object.entries(compByNiche).sort((a,b) => b[1]-a[1])) {
    console.log(`    ${n.padEnd(30)} ${cnt}`)
  }

  // ── 2. KWALIFICATIERATIO — new definition ─────────────────────────────────
  hr('2. Kwalificatieratio — new definition (routing-based)')

  // For this week's leads:
  //   gekwalificeerd  = board_type='company' AND contractor_id IS NOT NULL
  //   ongekwalificeerd = board_type='general' AND canonical_stage IN ('lost','deferred')
  //   in_behandeling  = board_type='general' AND canonical_stage = 'new'
  //   ratio = gekwalificeerd / (gekwalificeerd + ongekwalificeerd)

  const gekwalificeerd    = onCompany.length
  const ongekwalificeerd  = onGeneral.filter(l =>
    l.canonical_stage === 'lost' || l.canonical_stage === 'deferred'
  ).length
  const inBehandeling     = onGeneral.filter(l => l.canonical_stage === 'new').length
  const denominator       = gekwalificeerd + ongekwalificeerd

  console.log(`  Gekwalificeerd (routed to company)  : ${gekwalificeerd}`)
  console.log(`  Ongekwalificeerd (lost/deferred)    : ${ongekwalificeerd}`)
  console.log(`  In behandeling (still on general)   : ${inBehandeling}`)
  console.log(`  Denominator (excl. in_behandeling)  : ${denominator}`)
  console.log(`  Kwalificatieratio                   : ${pct(gekwalificeerd, denominator)}`)

  // Per-niche breakdown (company leads only)
  console.log(`\n  Per-niche (routed leads this week):`)
  const niches = [...new Set(onCompany.map(l => l.niche ?? 'onbekend'))]
  for (const niche of niches.sort()) {
    const routed = onCompany.filter(l => (l.niche ?? 'onbekend') === niche).length
    console.log(`    ${niche.padEnd(30)} ${routed} routed`)
  }

  // ── 3. OPEN OFFERTES — quote_amount audit ─────────────────────────────────
  hr('3. Open offertes — quote_amount population audit')

  const { data: quotedLeads } = await db
    .from('leads')
    .select('id, contractor_id, quote_amount, niche')
    .eq('canonical_stage', 'quote_sent')
    .not('contractor_id', 'is', null)

  const totalQuoted   = quotedLeads?.length ?? 0
  const withAmount    = quotedLeads?.filter(l => l.quote_amount != null && l.quote_amount > 0) ?? []
  const sumAmount     = withAmount.reduce((s, l) => s + (l.quote_amount ?? 0), 0)

  console.log(`  Leads in quote_sent stage            : ${totalQuoted}`)
  console.log(`  With quote_amount populated (> 0)    : ${withAmount.length}`)
  console.log(`  Without quote_amount                 : ${totalQuoted - withAmount.length}`)
  console.log(`  Sum of known quote_amount            : €${sumAmount.toLocaleString('nl-NL')}`)
  console.log(`  Coverage                             : ${pct(withAmount.length, totalQuoted)}`)

  if (withAmount.length > 0) {
    const byContractor: Record<string, { count: number; sum: number }> = {}
    for (const l of withAmount) {
      const cid = l.contractor_id ?? 'unknown'
      if (!byContractor[cid]) byContractor[cid] = { count: 0, sum: 0 }
      byContractor[cid].count++
      byContractor[cid].sum += l.quote_amount ?? 0
    }
    console.log(`\n  Known amounts by contractor_id:`)
    for (const [cid, { count, sum }] of Object.entries(byContractor)) {
      console.log(`    ${cid.slice(0,8)}…  ${count} leads  €${sum.toLocaleString('nl-NL')}`)
    }
  }

  // ── 4. BOARD COLUMN AUDIT — aanneemsom / offerte / bedrag ─────────────────
  hr('4. Board column audit — aanneemsom/offerte/bedrag columns')

  const { data: boards } = await db
    .from('boards')
    .select('id, name, board_type, monday_board_id')
    .eq('board_type', 'company')
    .eq('active', true)
    .order('name')

  if (!boards?.length) {
    console.log('  No active company boards found in boards table.')
  } else {
    // Check board_column_map or equivalent table if it exists
    const { data: colMaps } = await db
      .from('board_column_maps')
      .select('board_id, monday_column_id, field_name, column_type')
      .in('board_id', boards.map(b => b.id))
      .or('field_name.ilike.%aanneemsom%,field_name.ilike.%offerte%,field_name.ilike.%bedrag%,field_name.ilike.%quote%')

    const colByBoard = new Map<string, typeof colMaps>()
    for (const col of colMaps ?? []) {
      if (!colByBoard.has(col.board_id)) colByBoard.set(col.board_id, [])
      colByBoard.get(col.board_id)!.push(col)
    }

    console.log(`  Active company boards (${boards.length} total):`)
    for (const board of boards) {
      const cols = colByBoard.get(board.id) ?? []
      const colStr = cols.length
        ? cols.map(c => `${c.field_name} (${c.monday_column_id})`).join(', ')
        : '✗ geen aanneemsom/offerte kolom gevonden'
      console.log(`    ${board.name.padEnd(40)} ${colStr}`)
    }
  }

  // ── 5. CURRENT pipelineValue logic — what is €200 coming from? ───────────
  hr('5. pipelineValue debug — what projects data underlies the €200?')

  const { data: openQuoteLeads } = await db
    .from('leads')
    .select('id, contractor_id, canonical_stage, quote_amount, niche')
    .eq('canonical_stage', 'quote_sent')
    .not('contractor_id', 'is', null)

  const { data: activeContractors } = await db
    .from('contractors')
    .select('id, name, commission_model, commission_rate')
    .eq('active', true)

  const contractorMap = new Map((activeContractors ?? []).map(c => [c.id, c]))

  const { data: projects } = await db
    .from('projects')
    .select('contractor_id, aanneemsom')
    .not('aanneemsom', 'is', null)

  const avgByContractor = new Map<string, number>()
  const projectsByC: Record<string, number[]> = {}
  for (const p of projects ?? []) {
    if (!projectsByC[p.contractor_id]) projectsByC[p.contractor_id] = []
    projectsByC[p.contractor_id].push(p.aanneemsom)
  }
  for (const [cid, vals] of Object.entries(projectsByC)) {
    avgByContractor.set(cid, vals.reduce((s,v) => s+v, 0) / vals.length)
  }

  let totalPipeline = 0
  const rows: string[] = []
  const byContractorQuotes: Record<string, typeof openQuoteLeads> = {}
  for (const l of openQuoteLeads ?? []) {
    if (!byContractorQuotes[l.contractor_id!]) byContractorQuotes[l.contractor_id!] = []
    byContractorQuotes[l.contractor_id!]!.push(l)
  }

  for (const [cid, leads] of Object.entries(byContractorQuotes)) {
    const c = contractorMap.get(cid)
    if (!c || c.commission_model === 'retainer') continue
    let val = 0
    if (c.commission_model === 'flat_fee' && c.commission_rate) {
      val = leads.length * c.commission_rate
    } else {
      const avg = avgByContractor.get(cid)
      const rate = c.commission_rate ?? 0.05
      val = avg ? Math.round(leads.length * avg * rate) : 0
    }
    totalPipeline += val
    rows.push(`  ${(c.name ?? cid).padEnd(40)} ${leads.length} offertes  avg aanneemsom €${Math.round(avgByContractor.get(cid) ?? 0).toLocaleString('nl-NL')}  → €${val.toLocaleString('nl-NL')}`)
  }

  for (const r of rows) console.log(r)
  console.log(`\n  TOTAL pipeline (commissie estimate)  : €${totalPipeline.toLocaleString('nl-NL')}`)
  console.log(`  (This should match or be close to what the StatCard shows)`)
}

main().catch(e => { console.error(e); process.exit(1) })
