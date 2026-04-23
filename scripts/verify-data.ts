import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function hr(label: string) {
  console.log('\n' + '═'.repeat(70))
  console.log(' ' + label)
  console.log('═'.repeat(70))
}

async function fetchAllLeads<T>(select: string): Promise<T[]> {
  const PAGE = 1000
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await db
      .from('leads')
      .select(select)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`fetchAllLeads: ${error.message}`)
    rows.push(...(data as T[]))
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return rows
}

async function main() {

  // ── Query 1: Status distribution per contractor ────────────────────────
  hr('1. Lead status distribution per contractor')

  type LeadRow = { current_status: string | null; contractor_id: string | null; contractors: { name: string; niche: string } | null }
  const leads = await fetchAllLeads<LeadRow>('current_status, contractor_id, contractors(name, niche)')

  const statusMap = new Map<string, Map<string, number>>()
  const contractorNiche = new Map<string, string>()
  for (const l of leads) {
    const name = l.contractors?.name ?? '(no contractor)'
    const niche = l.contractors?.niche ?? ''
    const status = l.current_status ?? ''
    contractorNiche.set(name, niche)
    if (!statusMap.has(name)) statusMap.set(name, new Map())
    const m = statusMap.get(name)!
    m.set(status, (m.get(status) ?? 0) + 1)
  }

  console.log('contractor'.padEnd(32) + 'niche'.padEnd(12) + 'status'.padEnd(48) + 'count')
  console.log('-'.repeat(100))
  for (const [contractor, statuses] of [...statusMap.entries()].sort()) {
    const sorted = [...statuses.entries()].sort((a, b) => b[1] - a[1])
    for (const [status, count] of sorted) {
      console.log(
        contractor.slice(0, 31).padEnd(32) +
        (contractorNiche.get(contractor) ?? '').padEnd(12) +
        (status || '(empty)').slice(0, 47).padEnd(48) +
        count
      )
    }
  }
  console.log(`\nTotal leads fetched: ${leads.length}`)

  // ── Query 2: Lead freshness per contractor ─────────────────────────────
  hr('2. Lead freshness per contractor')

  const now = Date.now()
  const d30 = new Date(now - 30 * 86400_000).toISOString()
  const d90 = new Date(now - 90 * 86400_000).toISOString()

  type L2 = { monday_created_at: string | null; contractor_id: string | null; contractors: { name: string } | null }
  const leads2 = await fetchAllLeads<L2>('monday_created_at, contractor_id, contractors(name)')

  const freshMap = new Map<string, { oldest: string; newest: string; last30: number; last90: number; total: number }>()
  for (const l of leads2) {
    const name = l.contractors?.name ?? '(no contractor)'
    const ts = l.monday_created_at ?? ''
    if (!freshMap.has(name)) freshMap.set(name, { oldest: ts, newest: ts, last30: 0, last90: 0, total: 0 })
    const m = freshMap.get(name)!
    m.total++
    if (ts && ts < m.oldest) m.oldest = ts
    if (ts && ts > m.newest) m.newest = ts
    if (ts > d30) m.last30++
    if (ts > d90) m.last90++
  }

  console.log('contractor'.padEnd(32) + 'oldest'.padEnd(14) + 'newest'.padEnd(14) + 'last_30d'.padEnd(10) + 'last_90d'.padEnd(10) + 'total')
  console.log('-'.repeat(90))
  for (const [name, m] of [...freshMap.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(
      name.slice(0, 31).padEnd(32) +
      (m.oldest ? m.oldest.slice(0, 10) : 'NULL').padEnd(14) +
      (m.newest ? m.newest.slice(0, 10) : 'NULL').padEnd(14) +
      String(m.last30).padEnd(10) +
      String(m.last90).padEnd(10) +
      m.total
    )
  }

  // ── Query 3: Projects sanity check ────────────────────────────────────
  hr('3. Projects per contractor — aanneemsom & commissie')

  const { data: projects } = await db
    .from('projects')
    .select('aanneemsom, commissie, commissie_status, contractor_id, contractors(name)')

  type P = { aanneemsom: number | null; commissie: number | null; commissie_status: string | null; contractor_id: string | null; contractors: { name: string } | null }
  const projs = projects as unknown as P[]

  const projMap = new Map<string, { count: number; aanneemsom: number; commissie: number; paid: number; pending: number }>()
  for (const p of projs) {
    const name = p.contractors?.name ?? '(NULL contractor)'
    if (!projMap.has(name)) projMap.set(name, { count: 0, aanneemsom: 0, commissie: 0, paid: 0, pending: 0 })
    const m = projMap.get(name)!
    m.count++
    m.aanneemsom += p.aanneemsom ?? 0
    m.commissie  += p.commissie ?? 0
    const cs = (p.commissie_status ?? '').toLowerCase()
    if (cs.includes('betaald') || cs === '100% betaald') m.paid++
    else m.pending++
  }

  console.log('contractor'.padEnd(32) + 'projects'.padEnd(10) + 'aanneemsom'.padEnd(16) + 'commissie'.padEnd(14) + 'paid'.padEnd(8) + 'pending')
  console.log('-'.repeat(95))
  for (const [name, m] of [...projMap.entries()].sort((a, b) => b[1].aanneemsom - a[1].aanneemsom)) {
    console.log(
      name.slice(0, 31).padEnd(32) +
      String(m.count).padEnd(10) +
      ('€' + m.aanneemsom.toLocaleString('nl-NL')).padEnd(16) +
      ('€' + m.commissie.toLocaleString('nl-NL')).padEnd(14) +
      String(m.paid).padEnd(8) +
      m.pending
    )
  }

  // ── Extra checks ──────────────────────────────────────────────────────
  hr('4. Null / empty status check')

  const nullStatus      = leads.filter(l => !l.current_status || l.current_status.trim() === '').length
  const nullContractor  = leads.filter(l => !l.contractor_id).length
  const nullProjContractor = projs.filter(p => !p.contractor_id).length

  console.log(`Leads with NULL/empty current_status: ${nullStatus}`)
  console.log(`Leads with NULL contractor_id:        ${nullContractor}  (${leads.length} total)`)
  console.log(`Projects with NULL contractor_id:     ${nullProjContractor}  (${projs.length} total)`)

  // ── All distinct status values ────────────────────────────────────────
  hr('5. All distinct current_status values (for normalization reference)')

  const allStatuses = new Map<string, number>()
  for (const l of leads) {
    const s = l.current_status ?? '(NULL)'
    allStatuses.set(s, (allStatuses.get(s) ?? 0) + 1)
  }
  for (const [s, n] of [...allStatuses.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  "${s}"`)
  }

  // ── canonical_stage coverage ──────────────────────────────────────────
  hr('6. canonical_stage coverage')

  type L3 = { canonical_stage: string | null; contractor_id: string | null }
  const leads3 = await fetchAllLeads<L3>('canonical_stage, contractor_id')

  const stageMap = new Map<string, number>()
  let nullStage = 0
  for (const l of leads3) {
    if (!l.canonical_stage) { nullStage++; continue }
    stageMap.set(l.canonical_stage, (stageMap.get(l.canonical_stage) ?? 0) + 1)
  }
  for (const [s, n] of [...stageMap.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${s}`)
  }
  if (nullStage > 0) console.log(`  ${String(nullStage).padStart(5)}  (NULL — unmapped status)`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
