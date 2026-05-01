import { SupabaseClient } from '@supabase/supabase-js'
import { serverClient } from './supabase-server'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeRange {
  from: Date
  to: Date
}

export interface MetricWithTrend {
  value: number | null
  previousPeriodValue: number | null
  trend: number | null  // % change, null if not computable
}

export interface ContractorRow {
  id: string
  name: string
  niche: string
  active: boolean
  commission_model: 'percentage' | 'flat_fee' | 'retainer' | null
  commission_rate: number | null
  monthly_retainer_fee: number | null  // Bouw Check revenue (our fee)
  monthly_ad_budget:    number | null  // pass-through to Meta — not our revenue
  retainer_billing: 'prepaid' | 'monthly' | 'quarterly' | null
  relationship_status: 'active' | 'at_risk' | 'winding_down' | null
  service_model: 'full_sales' | 'leads_only' | 'hands_off' | null
  qualification_model: 'pre_qualified' | 'unfiltered' | null
  target_monthly_leads: number | null
  target_monthly_deals: number | null
  target_monthly_revenue: number | null
  target_commission: number | null
}

// ── Time helpers ──────────────────────────────────────────────────────────────

export function currentMonth(): TimeRange {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

export function previousPeriod(range: TimeRange): TimeRange {
  const duration = range.to.getTime() - range.from.getTime()
  return {
    from: new Date(range.from.getTime() - duration - 1),
    to:   new Date(range.from.getTime() - 1),
  }
}

function pct(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function withTrend(value: number | null, prev: number | null): MetricWithTrend {
  return { value, previousPeriodValue: prev, trend: pct(value, prev) }
}

function db(): SupabaseClient { return serverClient() }

// ── Raw status strings per canonical stage ────────────────────────────────────
// Must exactly match group titles as stored in Monday.com (case-sensitive).

const STAGE_STATUSES: Record<string, string[]> = {
  new:        ['Open Leads', 'Open Leads huidig', 'Nieuwe Lead'],
  contacted:  ['1x gebeld', '2x gebeld', '3x gebeld', '4x gebeld',
               'Gebeld', 'Gesproken', 'Inplannen', 'In afwachting bevestiging'],
  inspection: ['Inspectie gepland'],
  quote_sent: ['Offerte verzonden', 'Offerte verstuurd', 'Laatste poging'],
  won:        ['Akkoord'],
  deferred:   ['Later opvolgen', 'Opvolgen', 'Follow up later'],
  lost:       ['Niet bereikbaar', 'Niet bereikbaar/geinteresseerd/al voorzien',
               'Niet bereikbaar/geïnteresseerd/al voorzien',
               'Niet geïnteresseerd', 'Geïnteresseerd', 'Al voorzien'],
}

// ── Commission helper ─────────────────────────────────────────────────────────

export function calcExpectedCommission(
  contractor: Pick<ContractorRow, 'commission_model' | 'commission_rate'>,
  aanneemsom: number,
): number {
  if (!contractor.commission_rate) return 0
  if (contractor.commission_model === 'flat_fee') return contractor.commission_rate
  return aanneemsom * contractor.commission_rate
}

// ── Contractor lookups ────────────────────────────────────────────────────────

export async function getContractor(contractorId: string): Promise<ContractorRow | null> {
  const { data } = await db()
    .from('contractors')
    .select('*')
    .eq('id', contractorId)
    .maybeSingle()
  return data as ContractorRow | null
}

export async function getActiveContractors(): Promise<ContractorRow[]> {
  const { data } = await db()
    .from('contractors')
    .select('*')
    .eq('active', true)
    .order('name')
  return (data ?? []) as ContractorRow[]
}

// ── Low-level helpers ─────────────────────────────────────────────────────────

// Count lead_status_changes for a contractor filtered by target statuses and time range.
// Uses embedded join (leads!inner) so we avoid fetching all lead IDs.
async function transitionsTo(
  contractorId: string,
  statuses: string[],
  range: TimeRange,
): Promise<number> {
  const { count } = await db()
    .from('lead_status_changes')
    .select('id, leads!inner(contractor_id)', { count: 'exact', head: true })
    .eq('leads.contractor_id', contractorId)
    .in('to_status', statuses)
    .gte('changed_at', range.from.toISOString())
    .lte('changed_at', range.to.toISOString())
  return count ?? 0
}

// Compute average days between two types of status transitions — shared core logic.
// Pass contractorIds to filter; pass empty array to query across all contractors.
async function avgDaysBetweenTransitionsCore(
  contractorIds: string[],    // empty = all contractors
  fromStatuses: string[],
  toStatuses: string[],
  range: TimeRange,
): Promise<number | null> {
  // Two static select paths so TypeScript can infer return types
  let fromChanges: { lead_id: string; changed_at: string }[] | null

  if (contractorIds.length > 0) {
    let q = db()
      .from('lead_status_changes')
      .select('lead_id, changed_at, leads!inner(contractor_id)')
      .in('to_status', fromStatuses)
      .gte('changed_at', range.from.toISOString())
      .lte('changed_at', range.to.toISOString())
    if (contractorIds.length === 1) q = (q as any).eq('leads.contractor_id', contractorIds[0])
    else q = (q as any).in('leads.contractor_id', contractorIds)
    const { data } = await q
    fromChanges = (data as { lead_id: string; changed_at: string }[] | null)
  } else {
    const { data } = await db()
      .from('lead_status_changes')
      .select('lead_id, changed_at')
      .in('to_status', fromStatuses)
      .gte('changed_at', range.from.toISOString())
      .lte('changed_at', range.to.toISOString())
    fromChanges = data
  }

  if (!fromChanges?.length) return null
  const leadIds = [...new Set(fromChanges.map(c => c.lead_id))]

  const { data: toChanges } = await db()
    .from('lead_status_changes')
    .select('lead_id, changed_at')
    .in('lead_id', leadIds)
    .in('to_status', toStatuses)
    .order('changed_at', { ascending: true })

  // For each "from" transition, find the first subsequent "to" transition on the same lead
  const firstToByLead = new Map<string, Date>()
  for (const tc of toChanges ?? []) {
    if (!firstToByLead.has(tc.lead_id)) firstToByLead.set(tc.lead_id, new Date(tc.changed_at))
  }

  let totalDays = 0
  let count = 0
  for (const fc of fromChanges) {
    const toDate = firstToByLead.get(fc.lead_id)
    const fromDate = new Date(fc.changed_at)
    if (toDate && toDate > fromDate) {
      totalDays += (toDate.getTime() - fromDate.getTime()) / 86_400_000
      count++
    }
  }
  return count ? Math.round((totalDays / count) * 10) / 10 : null
}

// Per-contractor wrapper (original signature preserved)
async function avgDaysBetweenTransitions(
  contractorId: string,
  fromStatuses: string[],
  toStatuses: string[],
  range: TimeRange,
): Promise<number | null> {
  return avgDaysBetweenTransitionsCore([contractorId], fromStatuses, toStatuses, range)
}

// ── Per-contractor metrics ────────────────────────────────────────────────────

export async function leadsReceived(contractorId: string, range: TimeRange): Promise<number> {
  const { count } = await db()
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('contractor_id', contractorId)
    .gte('monday_created_at', range.from.toISOString())
    .lte('monday_created_at', range.to.toISOString())
  return count ?? 0
}

export async function qualifiedLeads(contractorId: string, range: TimeRange): Promise<number> {
  const { count } = await db()
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('contractor_id', contractorId)
    .in('canonical_stage', ['inspection', 'quote_sent', 'won'])
    .gte('monday_created_at', range.from.toISOString())
    .lte('monday_created_at', range.to.toISOString())
  return count ?? 0
}

export async function qualificationRate(
  contractorId: string,
  range: TimeRange,
): Promise<number | null> {
  const contractor = await getContractor(contractorId)
  if (!contractor || contractor.commission_model === 'retainer') return null
  const [total, qualified] = await Promise.all([
    leadsReceived(contractorId, range),
    qualifiedLeads(contractorId, range),
  ])
  if (!total) return null
  return Math.round((qualified / total) * 1000) / 10
}

export async function inspectionsBooked(contractorId: string, range: TimeRange): Promise<number> {
  return transitionsTo(contractorId, STAGE_STATUSES.inspection, range)
}

export async function quotesSent(contractorId: string, range: TimeRange): Promise<number> {
  return transitionsTo(contractorId, STAGE_STATUSES.quote_sent, range)
}

export async function quotesWon(contractorId: string, range: TimeRange): Promise<number> {
  return transitionsTo(contractorId, STAGE_STATUSES.won, range)
}

export async function closeRate(
  contractorId: string,
  range: TimeRange,
): Promise<number | null> {
  const [sent, won] = await Promise.all([
    quotesSent(contractorId, range),
    quotesWon(contractorId, range),
  ])
  if (!sent) return null
  return Math.round((won / sent) * 1000) / 10
}

export async function avgDealSize(
  contractorId: string,
  range: TimeRange,
): Promise<number | null> {
  const { data } = await db()
    .from('projects')
    .select('aanneemsom')
    .eq('contractor_id', contractorId)
    .not('aanneemsom', 'is', null)
    .gte('monday_created_at', range.from.toISOString())
    .lte('monday_created_at', range.to.toISOString())
  if (!data?.length) return null
  return Math.round(data.reduce((s, p) => s + (p.aanneemsom ?? 0), 0) / data.length)
}

export async function avgDaysToQuote(contractorId: string, range: TimeRange): Promise<number | null> {
  return avgDaysBetweenTransitions(
    contractorId, STAGE_STATUSES.inspection, STAGE_STATUSES.quote_sent, range,
  )
}

export async function avgDaysQuoteToClose(contractorId: string, range: TimeRange): Promise<number | null> {
  return avgDaysBetweenTransitions(
    contractorId, STAGE_STATUSES.quote_sent, STAGE_STATUSES.won, range,
  )
}

export async function pipelineValue(contractorId: string): Promise<number> {
  const [contractor, { count: quoteSentCount }] = await Promise.all([
    getContractor(contractorId),
    db()
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('contractor_id', contractorId)
      .eq('canonical_stage', 'quote_sent'),
  ])
  if (!contractor || !quoteSentCount) return 0
  if (contractor.commission_model === 'retainer') return 0

  if (contractor.commission_model === 'flat_fee' && contractor.commission_rate) {
    return quoteSentCount * contractor.commission_rate
  }

  // Percentage model: estimate from historical project aanneemsom
  const { data: projects } = await db()
    .from('projects')
    .select('aanneemsom')
    .eq('contractor_id', contractorId)
    .not('aanneemsom', 'is', null)

  const rate = contractor.commission_rate ?? 0.05
  if (projects?.length) {
    const avgAanneemsom = projects.reduce((s, p) => s + (p.aanneemsom ?? 0), 0) / projects.length
    return Math.round(quoteSentCount * avgAanneemsom * rate)
  }

  // Last resort: target_monthly_revenue / target_monthly_leads
  if (contractor.target_monthly_revenue && contractor.target_monthly_leads) {
    const estDeal = contractor.target_monthly_revenue / contractor.target_monthly_leads
    return Math.round(quoteSentCount * estDeal * rate)
  }
  return 0
}

// All revenue types — ad_budget is real revenue (invoiced to client), not pass-through
export const INCOME_TYPES_BY_MODEL: Record<string, string[]> = {
  retainer:   ['retainer_fee',          'ad_budget'],
  percentage: ['commission_percentage', 'ad_budget'],
  flat_fee:   ['commission_flat',       'ad_budget'],
}
export const ALL_INCOME_TYPES = ['retainer_fee', 'commission_percentage', 'commission_flat', 'ad_budget', 'other']

export async function commissionBooked(contractorId: string, range: TimeRange): Promise<number> {
  const contractor = await getContractor(contractorId)
  if (!contractor) return 0

  const types = INCOME_TYPES_BY_MODEL[contractor.commission_model ?? ''] ?? ALL_INCOME_TYPES
  const { data } = await db()
    .from('revenue_entries')
    .select('amount')
    .eq('contractor_id', contractorId)
    .in('type', types)
    .eq('payment_status', 'paid')
    .gte('entry_date', range.from.toISOString().slice(0, 10))
    .lte('entry_date', range.to.toISOString().slice(0, 10))
  return (data ?? []).reduce((s, e) => s + Number((e as { amount: number }).amount), 0)
}

export async function commissionPending(contractorId: string): Promise<number> {
  const { data } = await db()
    .from('projects')
    .select('commissie, commissie_status')
    .eq('contractor_id', contractorId)
    .not('commissie', 'is', null)
    .gt('commissie', 0)
  return (data ?? [])
    .filter(p => !p.commissie_status?.toLowerCase().includes('betaald'))
    .reduce((s, p) => s + (p.commissie ?? 0), 0)
}

export async function overdueFollowUps(contractorId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const { count } = await db()
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('contractor_id', contractorId)
    .not('follow_up_date', 'is', null)
    .lt('follow_up_date', today)
    .not('canonical_stage', 'in', '(won,lost)')
  return count ?? 0
}

// ── Business-wide aggregations ────────────────────────────────────────────────

// Snapshot: how many leads (created in range, active contractors) sit at each stage RIGHT NOW.
// Useful as a stacked-bar distribution view — NOT a conversion funnel.
export async function funnelStageDistribution(range: TimeRange): Promise<Record<string, number>> {
  const contractors = await getActiveContractors()
  const activeIds = contractors.map(c => c.id)

  const { data } = await db()
    .from('leads')
    .select('canonical_stage')
    .in('contractor_id', activeIds)
    .gte('monday_created_at', range.from.toISOString())
    .lte('monday_created_at', range.to.toISOString())

  const counts: Record<string, number> = {
    new: 0, contacted: 0, inspection: 0, quote_sent: 0, won: 0, deferred: 0, lost: 0,
  }
  for (const l of data ?? []) {
    const stage = l.canonical_stage ?? 'unknown'
    if (stage in counts) counts[stage]++
  }
  return counts
}

// Alias kept for todayBundle internal use
const funnelCounts = funnelStageDistribution

// Returns how many days of lead_status_changes history we have, or null if none.
export async function syncDataAge(): Promise<number | null> {
  const { data } = await db()
    .from('lead_status_changes')
    .select('changed_at')
    .order('changed_at', { ascending: true })
    .limit(1)
  if (!data?.length) return null
  return (Date.now() - new Date(data[0].changed_at).getTime()) / 86_400_000
}

// Transition-based funnel: count unique leads that REACHED each stage at least once in range.
// Conversion rates = leads reaching stage N / leads reaching stage N-1, capped at 100%.
// Returns null rates when data age < 14 days (not enough history to be meaningful).
export interface FunnelTransitionsResult {
  stageCounts: Record<string, number>
  conversionRates: Record<string, number | null>
  daysOfData: number | null
  reliable: boolean  // false when < 14 days of history
}

const FUNNEL_STAGES = ['new', 'contacted', 'inspection', 'quote_sent', 'won'] as const
type FunnelStage = typeof FUNNEL_STAGES[number]

// Lowercase status → canonical stage lookup for matching transition records
const STATUS_TO_STAGE = new Map<string, string>()
for (const [stage, statuses] of Object.entries(STAGE_STATUSES)) {
  for (const s of statuses) STATUS_TO_STAGE.set(s.toLowerCase(), stage)
}

export async function funnelTransitions(range: TimeRange): Promise<FunnelTransitionsResult> {
  const daysOfData = await syncDataAge()
  const reliable = (daysOfData ?? 0) >= 14

  const contractors = await getActiveContractors()
  const activeIds = contractors.map(c => c.id)

  // Fetch all status changes for active-contractor leads in range, using embedded join
  // to avoid passing 1000+ lead IDs in a URL parameter.
  const { data: changes } = await db()
    .from('lead_status_changes')
    .select('lead_id, to_status, leads!inner(contractor_id)')
    .in('leads.contractor_id', activeIds)
    .gte('changed_at', range.from.toISOString())
    .lte('changed_at', range.to.toISOString())

  // Count unique leads that reached each funnel stage
  const reached: Record<FunnelStage, Set<string>> = {
    new: new Set(), contacted: new Set(), inspection: new Set(),
    quote_sent: new Set(), won: new Set(),
  }
  for (const c of changes ?? []) {
    const stage = STATUS_TO_STAGE.get(c.to_status.trim().toLowerCase())
    if (stage && stage in reached) reached[stage as FunnelStage].add(c.lead_id)
  }

  const stageCounts = Object.fromEntries(
    FUNNEL_STAGES.map(s => [s, reached[s].size])
  ) as Record<string, number>

  // Conversion rates — capped at 100%, null when unreliable or denominator is zero
  const conversionRates: Record<string, number | null> = {}
  for (let i = 0; i < FUNNEL_STAGES.length - 1; i++) {
    const from = FUNNEL_STAGES[i]
    const to   = FUNNEL_STAGES[i + 1]
    const key  = `${from}_to_${to}`
    if (!reliable) { conversionRates[key] = null; continue }
    const fromCount = stageCounts[from]
    if (!fromCount) { conversionRates[key] = null; continue }
    const rate = Math.round((stageCounts[to] / fromCount) * 1000) / 10
    if (rate > 100) {
      console.warn(`[metrics] funnelTransitions: ${key}=${rate}% exceeds 100% — returning null`)
      conversionRates[key] = null
    } else {
      conversionRates[key] = rate
    }
  }

  return { stageCounts, conversionRates, daysOfData, reliable }
}

export async function totalPipelineValue(): Promise<number> {
  const contractors = await getActiveContractors()
  const values = await Promise.all(contractors.map(c => pipelineValue(c.id)))
  return values.reduce((s, v) => s + v, 0)
}

// Commission state machine:
//   Lead in quote_sent stage → potential (not tracked until Aanneemsom column capture)
//   Project with commissie > 0 and commissie_status != 'betaald' → EARNED, awaiting payout
//   Project with commissie_status = 'betaald' this month → PAID this month
export async function totalCommissionBooked(range: TimeRange): Promise<number> {
  const contractors = await getActiveContractors()
  const activeIds   = contractors.map(c => c.id)
  const fromDate    = range.from.toISOString().slice(0, 10)
  const toDate      = range.to.toISOString().slice(0, 10)

  const { data } = await db()
    .from('revenue_entries')
    .select('amount')
    .in('contractor_id', activeIds)
    .in('type', ALL_INCOME_TYPES)
    .eq('payment_status', 'paid')
    .gte('entry_date', fromDate)
    .lte('entry_date', toDate)

  return (data ?? []).reduce((s, e) => s + Number((e as { amount: number }).amount), 0)
}

export async function totalCommissionPending(): Promise<number> {
  const contractors = await getActiveContractors()
  const activeIds = contractors.map(c => c.id)
  const { data } = await db()
    .from('projects')
    .select('commissie, commissie_status')
    .in('contractor_id', activeIds)
    .not('commissie', 'is', null)
    .gt('commissie', 0)
  return (data ?? [])
    .filter(p => !p.commissie_status?.toLowerCase().includes('betaald'))
    .reduce((s, p) => s + (p.commissie ?? 0), 0)
}

export async function unroutedLeads(range: TimeRange): Promise<number> {
  const { count } = await db()
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .is('contractor_id', null)
    .gte('monday_created_at', range.from.toISOString())
    .lte('monday_created_at', range.to.toISOString())
  return count ?? 0
}

// ── Contractor leaderboard (batch-efficient) ──────────────────────────────────
// Fetches all data in 2 queries and computes per-contractor metrics in JS.

export type ContractorHealth =
  | 'on-track'          // 60+ days active, ≥1 won deal, close rate >15%  → Performing
  | 'warning'           // 60+ days active, 5+ quotes, close rate <15%    → Let op
  | 'critical'          // manual at_risk flag                             → Kritiek
  | 'idle'              // no leads received in last 30 days               → Inactief
  | 'active'            // hands_off model or fallback with leads          → Lopend
  | 'insufficient-data' // <60 days since first lead received              → Onvoldoende data

export interface ContractorSummary {
  id: string
  name: string
  niche: string
  commission_model:    'percentage' | 'flat_fee' | 'retainer' | null
  service_model:       'full_sales' | 'leads_only' | 'hands_off' | null
  qualification_model: 'pre_qualified' | 'unfiltered' | null
  relationship_status:  'active' | 'at_risk' | 'winding_down' | null
  monthly_retainer_fee: number | null  // our revenue
  monthly_ad_budget:    number | null  // pass-through, not revenue
  retainer_billing:     'prepaid' | 'monthly' | 'quarterly' | null
  commission_rate:       number | null
  target_monthly_leads:  number | null
  target_monthly_deals:  number | null
  target_monthly_revenue: number | null
  target_commission:     number | null
  leadsReceived:     number
  qualifiedLeads:    number
  qualificationRate: number | null  // null for unfiltered/hands_off
  closeRate:         number | null  // null for leads_only/hands_off — won/(won+quote_sent) in period
  avgDealSize:       number | null  // null for flat_fee/hands_off
  commissionBooked:  number
  commissionPending: number
  pipelineValueEst:  number
  backlogDebt:       number         // open-stage leads >14d with no Monday activity
  lastActivity:      string | null  // ISO string of most recent lead update
  health:            ContractorHealth
  // Stage counts — period cohort (leads that entered in the date range)
  periodStages: {
    new: number; contacted: number; inspection: number; quote_sent: number
    won: number; lost: number; deferred: number
  }
  // Snapshot counts — current state of all leads ever (for "open pipeline" display)
  snapshotStages: {
    new: number; contacted: number; inspection: number; quote_sent: number
    won: number; lost: number
  }
  // Active lead packs summary
  activePacks: {
    count:    number
    pct?:     number   // only when count === 1
    used?:    number
    promised?: number
    niche?:   string
  }
}

export async function contractorLeaderboard(range: TimeRange): Promise<ContractorSummary[]> {
  const contractors    = await getActiveContractors()
  const activeIds      = contractors.map(c => c.id)
  const backlogCutoff  = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const last30dCutoff  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const fromDate       = range.from.toISOString().slice(0, 10)
  const toDate         = range.to.toISOString().slice(0, 10)

  const [{ data: leads }, { data: projects }, { data: allLeads }, { data: backlogLeads }, invoiceResult, { data: activePacks }] = await Promise.all([
    db()
      .from('leads')
      .select('contractor_id, canonical_stage, monday_updated_at')
      .in('contractor_id', activeIds)
      .gte('monday_created_at', range.from.toISOString())
      .lte('monday_created_at', range.to.toISOString())
      .limit(5000),
    db()
      .from('projects')
      .select('contractor_id, aanneemsom, commissie, commissie_status')
      .in('contractor_id', activeIds),
    db()
      .from('leads')
      .select('contractor_id, canonical_stage, monday_updated_at, monday_created_at')
      .in('contractor_id', activeIds)
      .limit(5000),
    db()
      .from('leads')
      .select('contractor_id')
      .in('contractor_id', activeIds)
      .in('canonical_stage', ['new', 'contacted', 'inspection', 'quote_sent'])
      .lt('monday_updated_at', backlogCutoff)
      .limit(5000),
    db()
      .from('revenue_entries')
      .select('contractor_id, amount, type')
      .in('contractor_id', activeIds)
      .in('type', ALL_INCOME_TYPES)
      .eq('payment_status', 'paid')
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate),
    db()
      .from('lead_packs')
      .select('id, contractor_id, niche, pack_type, units_promised, units_used')
      .in('contractor_id', activeIds)
      .eq('status', 'active'),
  ])

  type RevRow = { contractor_id: string; amount: number; type: string }
  const revenueEntries = ((invoiceResult as { data: RevRow[] | null }).data ?? [])

  return contractors.map(c => {
    const cLeads    = (leads    ?? []).filter(l => l.contractor_id === c.id)
    const cProjects = (projects ?? []).filter(p => p.contractor_id === c.id)
    const cAllLeads = (allLeads ?? []).filter(l => l.contractor_id === c.id)
    const cBacklog  = (backlogLeads ?? []).filter(l => l.contractor_id === c.id)

    const isRetainer  = c.commission_model === 'retainer'
    const isHandsOff  = c.service_model === 'hands_off'
    const isLeadsOnly = c.service_model === 'leads_only'
    const isUnfiltered = c.qualification_model === 'unfiltered'

    const total        = cLeads.length
    const qualified    = cLeads.filter(l => ['inspection', 'quote_sent', 'won'].includes(l.canonical_stage)).length
    const wonInPeriod  = cLeads.filter(l => l.canonical_stage === 'won').length
    const quoteInPeriod = cLeads.filter(l => l.canonical_stage === 'quote_sent' || l.canonical_stage === 'won').length
    const quoteSentNow = cAllLeads.filter(l => l.canonical_stage === 'quote_sent').length

    // Close rate: won / (won + quote_sent) in period — meaningful only for full_sales.
    // Display null (shows "—") when quoteInPeriod < 5 (insufficient sample).
    const closeRateRaw = (isHandsOff || isLeadsOnly || quoteInPeriod === 0)
      ? null
      : Math.round((wonInPeriod / quoteInPeriod) * 1000) / 10
    const closeRate = quoteInPeriod >= 5 ? closeRateRaw : null

    // Avg deal size from actual project aanneemsom data
    const dealsWithAmount = cProjects.filter(p => p.aanneemsom && p.aanneemsom > 0)
    const avgDealSize = (isHandsOff || c.commission_model === 'flat_fee' || dealsWithAmount.length === 0)
      ? null
      : Math.round(dealsWithAmount.reduce((s, p) => s + (p.aanneemsom ?? 0), 0) / dealsWithAmount.length)

    const commBooked = revenueEntries
      .filter(e => e.contractor_id === c.id)
      .reduce((s, e) => s + Number(e.amount), 0)

    const commPending = isRetainer ? 0 : cProjects
      .filter(p => p.commissie && p.commissie > 0 && !p.commissie_status?.toLowerCase().includes('betaald'))
      .reduce((s, p) => s + (p.commissie ?? 0), 0)

    let pipeEst = 0
    if (!isRetainer) {
      if (c.commission_model === 'flat_fee' && c.commission_rate) {
        pipeEst = quoteSentNow * c.commission_rate
      } else if (c.commission_rate) {
        const avgAanneemsom = dealsWithAmount.length > 0
          ? dealsWithAmount.reduce((s, p) => s + (p.aanneemsom ?? 0), 0) / dealsWithAmount.length
          : (c.target_monthly_revenue && c.target_monthly_leads
              ? c.target_monthly_revenue / c.target_monthly_leads : 0)
        pipeEst = Math.round(quoteSentNow * avgAanneemsom * (c.commission_rate ?? 0))
      }
    }

    // Last activity: most recent monday_updated_at across all this contractor's leads
    const lastActivity = cAllLeads.reduce<string | null>((best, l) => {
      if (!l.monday_updated_at) return best
      return !best || l.monday_updated_at > best ? l.monday_updated_at : best
    }, null)

    const qualRate = (isUnfiltered || isHandsOff) ? null
                       : (total > 0 ? Math.round(qualified / total * 1000) / 10 : null)

    // All-time metrics for status evaluation (period metrics used for display only)
    const wonAllTime   = cAllLeads.filter(l => l.canonical_stage === 'won').length
    const quoteAllTime = cAllLeads.filter(l => l.canonical_stage === 'quote_sent' || l.canonical_stage === 'won').length
    const closeRateAllTime = quoteAllTime > 0 ? (wonAllTime / quoteAllTime) * 100 : 0

    // How long has this contractor been active (days since first lead created)
    const firstLeadDate = cAllLeads.reduce<string | null>((min, l) => {
      if (!l.monday_created_at) return min
      return min === null || l.monday_created_at < min ? l.monday_created_at : min
    }, null)
    const daysActive = firstLeadDate
      ? Math.floor((Date.now() - new Date(firstLeadDate).getTime()) / 86_400_000)
      : 0

    // Leads created in the last 30 days (for inactief check)
    const recentLeads = cAllLeads.filter(l => l.monday_created_at && l.monday_created_at >= last30dCutoff).length

    // At least one quote_sent lead >30 days old — guards Let op against active pipelines
    const oldQuoteCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const hasStaleQuote  = cAllLeads.some(
      l => l.canonical_stage === 'quote_sent' && l.monday_created_at && l.monday_created_at < oldQuoteCutoff
    )

    // Performing and Let op are only meaningful for full_sales contractors who track
    // their pipeline through quote_sent → won. leads_only boards have no quote_sent
    // stage, so close rate is artificially 100% (won/won), making Performing fire
    // incorrectly. Skip both checks for leads_only.
    const canEvaluateClosing = !isLeadsOnly

    // Health decision tree — first match wins
    let health: ContractorHealth
    if (recentLeads === 0) {
      health = 'idle'              // Inactief: no leads in last 30 days
    } else if (c.relationship_status === 'at_risk') {
      health = 'critical'          // Kritiek: manual at_risk flag
    } else if (isHandsOff) {
      health = 'active'            // Lopend: hands_off, no pipeline visibility
    } else if (daysActive < 60 || cAllLeads.length < 10) {
      health = 'insufficient-data' // Onvoldoende data: too new or too few leads
    } else if (canEvaluateClosing && wonAllTime >= 1 && closeRateAllTime > 15) {
      health = 'on-track'          // Performing: proven closer with real pipeline data
    } else if (canEvaluateClosing && quoteAllTime >= 5 && hasStaleQuote && closeRateAllTime < 15) {
      health = 'warning'           // Let op: stale quotes + consistently low close rate
    } else {
      health = 'active'            // Lopend: fallback
    }

    const cPacks = (activePacks ?? []).filter(p => p.contractor_id === c.id)
    const packSummary = cPacks.length === 0
      ? { count: 0 }
      : cPacks.length === 1
        ? {
            count:    1,
            pct:      cPacks[0].units_promised > 0
                        ? Math.round((cPacks[0].units_used / cPacks[0].units_promised) * 100)
                        : 0,
            used:     Number(cPacks[0].units_used),
            promised: Number(cPacks[0].units_promised),
            niche:    cPacks[0].niche,
          }
        : { count: cPacks.length }

    return {
      id:                   c.id,
      name:                 c.name,
      niche:                c.niche,
      commission_model:     c.commission_model,
      service_model:        c.service_model,
      qualification_model:  c.qualification_model,
      relationship_status:  c.relationship_status,
      monthly_retainer_fee: c.monthly_retainer_fee,
      monthly_ad_budget:    c.monthly_ad_budget,
      retainer_billing:     c.retainer_billing,
      commission_rate:       c.commission_rate,
      target_monthly_leads:  c.target_monthly_leads,
      target_monthly_deals:  c.target_monthly_deals,
      target_monthly_revenue: c.target_monthly_revenue,
      target_commission:     c.target_commission,
      leadsReceived:        total,
      qualifiedLeads:       qualified,
      qualificationRate:    qualRate,
      closeRate,
      avgDealSize,
      commissionBooked:     commBooked,
      commissionPending:    commPending,
      pipelineValueEst:     pipeEst,
      backlogDebt:          cBacklog.length,
      lastActivity,
      health,
      activePacks:          packSummary,
      periodStages: {
        new:        cLeads.filter(l => l.canonical_stage === 'new').length,
        contacted:  cLeads.filter(l => l.canonical_stage === 'contacted').length,
        inspection: cLeads.filter(l => l.canonical_stage === 'inspection').length,
        quote_sent: cLeads.filter(l => l.canonical_stage === 'quote_sent').length,
        won:        wonInPeriod,
        lost:       cLeads.filter(l => l.canonical_stage === 'lost').length,
        deferred:   cLeads.filter(l => l.canonical_stage === 'deferred').length,
      },
      snapshotStages: {
        new:        cAllLeads.filter(l => l.canonical_stage === 'new').length,
        contacted:  cAllLeads.filter(l => l.canonical_stage === 'contacted').length,
        inspection: cAllLeads.filter(l => l.canonical_stage === 'inspection').length,
        quote_sent: cAllLeads.filter(l => l.canonical_stage === 'quote_sent').length,
        won:        cAllLeads.filter(l => l.canonical_stage === 'won').length,
        lost:       cAllLeads.filter(l => l.canonical_stage === 'lost').length,
      },
    }
  })
}

// ── Finance breakdown ─────────────────────────────────────────────────────────

export interface FinanceByModel {
  commissionBooked: number
  commissionPending: number
  projectCount: number
}

export interface FinanceSummary {
  percentage: FinanceByModel & { contractors: string[] }
  flat_fee:   FinanceByModel & { contractors: string[]; ratePerDeal: number | null }
  totals: { booked: number; pending: number }
}

export async function financeSummary(range: TimeRange): Promise<FinanceSummary> {
  const contractors = await getActiveContractors()
  const activeIds = contractors.map(c => c.id)

  const { data: projects } = await db()
    .from('projects')
    .select('contractor_id, commissie, commissie_status, monday_created_at')
    .in('contractor_id', activeIds)
    .gte('monday_created_at', range.from.toISOString())
    .lte('monday_created_at', range.to.toISOString())

  const contractorById = new Map(contractors.map(c => [c.id, c]))

  const pct: FinanceByModel & { contractors: Set<string> } = {
    commissionBooked: 0, commissionPending: 0, projectCount: 0, contractors: new Set(),
  }
  const flat: FinanceByModel & { contractors: Set<string> } = {
    commissionBooked: 0, commissionPending: 0, projectCount: 0, contractors: new Set(),
  }
  const flatRates = new Set<number>()

  for (const p of projects ?? []) {
    const c = contractorById.get(p.contractor_id ?? '')
    if (!c) continue
    const bucket = c.commission_model === 'flat_fee' ? flat : pct
    const paid = p.commissie_status?.toLowerCase().includes('betaald') ?? false
    bucket.projectCount++
    bucket.contractors.add(c.name)
    if (paid) bucket.commissionBooked += p.commissie ?? 0
    else       bucket.commissionPending += p.commissie ?? 0
    if (c.commission_model === 'flat_fee' && c.commission_rate) flatRates.add(c.commission_rate)
  }

  return {
    percentage: { ...pct, contractors: [...pct.contractors] },
    flat_fee:   {
      ...flat,
      contractors: [...flat.contractors],
      ratePerDeal: flatRates.size === 1 ? [...flatRates][0] : null,
    },
    totals: {
      booked:  pct.commissionBooked  + flat.commissionBooked,
      pending: pct.commissionPending + flat.commissionPending,
    },
  }
}

// ── Today bundle (single-call convenience) ────────────────────────────────────

export async function todayBundle() {
  const range = currentMonth()
  const prev  = previousPeriod(range)
  const today = new Date()
  const todayRange: TimeRange = {
    from: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    to:   new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
  }

  const [
    leadsToday,
    leadsTodayPrev,
    leadsMonth,
    leadsMonthPrev,
    unrouted,
    funnel,
    commBooked,
    commPending,
    leaderboard,
  ] = await Promise.all([
    unroutedLeads(todayRange).then(() => 0).catch(() => 0), // placeholder, see below
    Promise.resolve(0),
    (async () => {
      const contractors = await getActiveContractors()
      const ids = contractors.map(c => c.id)
      const { count } = await db()
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .in('contractor_id', ids)
        .gte('monday_created_at', range.from.toISOString())
        .lte('monday_created_at', range.to.toISOString())
      return count ?? 0
    })(),
    (async () => {
      const contractors = await getActiveContractors()
      const ids = contractors.map(c => c.id)
      const { count } = await db()
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .in('contractor_id', ids)
        .gte('monday_created_at', prev.from.toISOString())
        .lte('monday_created_at', prev.to.toISOString())
      return count ?? 0
    })(),
    unroutedLeads(range),
    funnelCounts(range),
    totalCommissionBooked(range),
    totalCommissionPending(),
    contractorLeaderboard(range),
  ])

  // Active leads received today (across active contractors)
  const contractors = await getActiveContractors()
  const ids = contractors.map(c => c.id)
  const { count: todayCount } = await db()
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .in('contractor_id', ids)
    .gte('monday_created_at', todayRange.from.toISOString())
    .lte('monday_created_at', todayRange.to.toISOString())

  // Overdue follow-ups across all active contractors
  const overdueArr = await Promise.all(contractors.map(c => overdueFollowUps(c.id)))
  const totalOverdue = overdueArr.reduce((s, v) => s + v, 0)

  return {
    period: {
      from: range.from.toISOString(),
      to:   range.to.toISOString(),
    },
    leadsToday:          withTrend(todayCount ?? 0, null),
    leadsThisMonth:      withTrend(leadsMonth, leadsMonthPrev),
    unroutedLeads:       unrouted,
    overdueFollowUps:    totalOverdue,
    funnelCounts:        funnel,
    totalCommissionBooked:  commBooked,
    totalCommissionPending: commPending,
    contractorSummaries:    leaderboard,
  }
}

// ── Week helpers ──────────────────────────────────────────────────────────────

function currentWeekRange(): TimeRange {
  const now  = new Date()
  const day  = now.getDay()                       // 0=Sun
  const mon  = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))   // back to Monday
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return { from: mon, to: sun }
}

export interface WeekBucket {
  label: string    // "W15" or "18 apr"
  from:  string    // ISO
  to:    string    // ISO
  count: number
}

export async function weeklyMomentum(weeks = 8): Promise<WeekBucket[]> {
  const contractors = await getActiveContractors()
  const activeIds   = contractors.map(c => c.id)

  // Build week buckets from oldest to newest
  const current = currentWeekRange()
  const buckets: Array<{ from: Date; to: Date }> = []
  for (let i = weeks - 1; i >= 0; i--) {
    const from = new Date(current.from.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const to   = new Date(current.to.getTime()   - i * 7 * 24 * 60 * 60 * 1000)
    buckets.push({ from, to })
  }

  // Single query covering the entire range — all leads, not just contractor-assigned,
  // so the chart reflects total Meta intake (including unrouted bouw leads)
  const rangeFrom = buckets[0].from.toISOString()
  const rangeTo   = buckets[buckets.length - 1].to.toISOString()
  const { data } = await db()
    .from('leads')
    .select('monday_created_at')
    .gte('monday_created_at', rangeFrom)
    .lte('monday_created_at', rangeTo)

  const rows = data ?? []
  return buckets.map(b => {
    const count = rows.filter(r => {
      const t = new Date(r.monday_created_at).getTime()
      return t >= b.from.getTime() && t <= b.to.getTime()
    }).length

    // Label: "18 apr" for the week starting that Monday
    const label = b.from.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
    return { label, from: b.from.toISOString(), to: b.to.toISOString(), count }
  })
}

// ── Detailed week stats (all leads inc. unrouted) ────────────────────────────

export interface LeadsThisWeekDetailed {
  total:          number                  // all leads received this week
  routed:         number                  // contractor_id IS NOT NULL
  inBehandeling:  number                  // unrouted, still in 'new'
  afgewezen:      number                  // unrouted, lost or deferred
  previous:       number                  // previous week total
  trend:          number | null
  byNiche:        Record<string, number>  // all leads (routed+unrouted) by niche
}

export async function leadsThisWeek(): Promise<LeadsThisWeekDetailed> {
  const week     = currentWeekRange()
  const prevFrom = new Date(week.from.getTime() - 7 * 24 * 60 * 60 * 1000)
  const prevTo   = new Date(week.to.getTime()   - 7 * 24 * 60 * 60 * 1000)

  const [{ data: allLeads }, { count: prevCount }, { data: boardConfigs }, { data: contractors }] = await Promise.all([
    db().from('leads')
      .select('contractor_id, canonical_stage, board_id')
      .gte('monday_created_at', week.from.toISOString())
      .lte('monday_created_at', week.to.toISOString()),
    db().from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('monday_created_at', prevFrom.toISOString())
      .lte('monday_created_at', prevTo.toISOString()),
    db().from('boards_config').select('id, niche'),
    db().from('contractors').select('id, niche'),
  ])

  const boardNiche      = new Map<number, string>((boardConfigs ?? []).filter(b => b.niche).map(b => [b.id, b.niche]))
  const contractorNiche = new Map<string, string>((contractors  ?? []).filter(c => c.niche).map(c => [c.id, c.niche]))

  const leads         = allLeads ?? []
  const unrouted      = leads.filter(l => l.contractor_id == null)
  const inBehandeling = unrouted.filter(l => l.canonical_stage === 'new').length
  const afgewezen     = unrouted.filter(l => l.canonical_stage === 'lost' || l.canonical_stage === 'deferred').length

  const byNiche: Record<string, number> = {}
  for (const l of leads) {
    const niche = l.contractor_id
      ? (contractorNiche.get(l.contractor_id) ?? 'onbekend')
      : (boardNiche.get(l.board_id)           ?? 'onbekend')
    byNiche[niche] = (byNiche[niche] ?? 0) + 1
  }

  const total    = leads.length
  const routed   = total - unrouted.length
  const previous = prevCount ?? 0
  const trend    = previous > 0 ? Math.round(((total - previous) / previous) * 1000) / 10 : null
  return { total, routed, inBehandeling, afgewezen, previous, trend, byNiche }
}

// ── Routing-based qualification stats ────────────────────────────────────────
// "Qualified" = routed to a contractor board.
// "Rejected"  = stayed on general board, moved to lost/deferred.
// "In behandeling" = still on general board, canonical_stage='new' — excluded from denominator.

export interface QualificationStats {
  ratio:            number | null
  routed:           number
  rejected:         number
  inBehandeling:    number
  byNiche:          Record<string, { routed: number; rejected: number; ratio: number | null }>
  filterableNiches: string[]   // niches with at least one full_sales contractor
}

export async function qualificationStats(range?: TimeRange): Promise<QualificationStats> {
  const week = range ?? currentWeekRange()

  const [{ data: allLeads }, { data: boardConfigs }, { data: contractors }] = await Promise.all([
    db().from('leads')
      .select('contractor_id, canonical_stage, board_id')
      .gte('monday_created_at', week.from.toISOString())
      .lte('monday_created_at', week.to.toISOString()),
    db().from('boards_config').select('id, niche'),
    db().from('contractors').select('id, niche, service_model'),
  ])

  const boardNiche      = new Map<number, string>((boardConfigs ?? []).filter(b => b.niche).map(b => [b.id, b.niche]))
  const contractorNiche = new Map<string, string>((contractors  ?? []).filter(c => c.niche).map(c => [c.id, c.niche]))
  const filterableNiches = [...new Set(
    (contractors ?? []).filter(c => c.service_model === 'full_sales' && c.niche).map(c => c.niche as string)
  )]

  const leads         = allLeads ?? []
  const routedLeads   = leads.filter(l => l.contractor_id != null)
  const unrouted      = leads.filter(l => l.contractor_id == null)
  const rejectedLeads = unrouted.filter(l => l.canonical_stage === 'lost' || l.canonical_stage === 'deferred')
  const inBehandeling = unrouted.filter(l => l.canonical_stage === 'new').length

  const routed      = routedLeads.length
  const rejected    = rejectedLeads.length
  const denominator = routed + rejected
  const ratio       = denominator > 0 ? Math.round((routed / denominator) * 1000) / 10 : null

  const byNiche: Record<string, { routed: number; rejected: number; ratio: number | null }> = {}
  for (const l of routedLeads) {
    const n = contractorNiche.get(l.contractor_id!) ?? 'onbekend'
    if (!byNiche[n]) byNiche[n] = { routed: 0, rejected: 0, ratio: null }
    byNiche[n].routed++
  }
  for (const l of rejectedLeads) {
    const n = boardNiche.get(l.board_id) ?? 'onbekend'
    if (!byNiche[n]) byNiche[n] = { routed: 0, rejected: 0, ratio: null }
    byNiche[n].rejected++
  }
  for (const v of Object.values(byNiche)) {
    const d = v.routed + v.rejected
    v.ratio = d > 0 ? Math.round((v.routed / d) * 1000) / 10 : null
  }

  return { ratio, routed, rejected, inBehandeling, byNiche, filterableNiches }
}

// ── Funnel page metrics ───────────────────────────────────────────────────────

// Current stage snapshot — all active-contractor leads, no date filter.
// Pass niche to restrict to one niche; omit for all niches.
export interface StageDistribution {
  counts:  Record<string, number>
  byNiche: Record<string, Record<string, number>>
}

// range is optional — when provided, filters by monday_created_at for "active period" view.
// Includes both contractor board leads (active contractors only) and general board leads
// (contractor_id IS NULL, resolved by board niche).
export async function currentStageDistribution(range?: TimeRange): Promise<StageDistribution> {
  const [contractors, { data: boardConfigs }] = await Promise.all([
    getActiveContractors(),
    db().from('boards_config').select('id, niche'),
  ])
  const nicheById  = new Map(contractors.map(c => [c.id, c.niche ?? 'onbekend']))
  const boardNiche = new Map<number, string>((boardConfigs ?? []).filter(b => b.niche).map(b => [b.id, b.niche]))

  let q = db()
    .from('leads')
    .select('contractor_id, canonical_stage, board_id')
    .limit(5000)

  if (range) {
    q = q
      .gte('monday_created_at', range.from.toISOString())
      .lte('monday_created_at', range.to.toISOString())
  }

  const { data } = await q

  const stages  = ['new', 'contacted', 'inspection', 'quote_sent', 'won', 'deferred', 'lost']
  const counts: Record<string, number> = Object.fromEntries(stages.map(s => [s, 0]))
  const byNiche: Record<string, Record<string, number>> = {}

  for (const l of data ?? []) {
    const niche: string | null = l.contractor_id
      ? (nicheById.get(l.contractor_id) ?? null)
      : (boardNiche.get(l.board_id)     ?? null)
    if (!niche) continue

    const stage = l.canonical_stage ?? 'unknown'
    if (stage in counts) counts[stage]++
    if (!byNiche[niche]) byNiche[niche] = Object.fromEntries(stages.map(s => [s, 0]))
    if (stage in byNiche[niche]) byNiche[niche][stage]++
  }

  return { counts, byNiche }
}

// Campaign performance table — per campaign_tag aggregation for a date range.
export interface CampaignRow {
  campaign_tag: string
  niche:        string | null
  leads:        number
  routed:       number
  inspecties:   number   // reached inspection or beyond (current canonical_stage)
  offertes:     number   // reached quote_sent or beyond
  gewonnen:     number   // won
}

export async function campaignPerformance(range?: TimeRange, niche?: string): Promise<CampaignRow[]> {
  let leadsQ = db().from('leads')
    .select('contractor_id, campaign_tag, canonical_stage, board_id')
    .not('campaign_tag', 'is', null)
    .neq('campaign_tag', '')
    .limit(5000)
  if (range) {
    leadsQ = leadsQ
      .gte('monday_created_at', range.from.toISOString())
      .lte('monday_created_at', range.to.toISOString())
  }

  const [{ data: leads }, { data: boardConfigs }, { data: contractors }] = await Promise.all([
    leadsQ,
    db().from('boards_config').select('id, niche'),
    db().from('contractors').select('id, niche'),
  ])

  const boardNiche      = new Map<number, string>((boardConfigs ?? []).filter(b => b.niche).map(b => [b.id, b.niche]))
  const contractorNiche = new Map<string, string>((contractors ?? []).filter(c => c.niche).map(c => [c.id, c.niche]))

  const rowMap = new Map<string, CampaignRow>()

  for (const l of leads ?? []) {
    const tag = l.campaign_tag!
    if (!tag || tag.length < 3 || tag.includes('@') || /hotmail|gmail|outlook|yahoo/i.test(tag)) continue
    const leadNiche = l.contractor_id
      ? (contractorNiche.get(l.contractor_id) ?? null)
      : (boardNiche.get(l.board_id) ?? null)

    if (niche && leadNiche !== niche) continue

    if (!rowMap.has(tag)) {
      rowMap.set(tag, { campaign_tag: tag, niche: leadNiche, leads: 0, routed: 0, inspecties: 0, offertes: 0, gewonnen: 0 })
    }
    const row = rowMap.get(tag)!
    row.leads++
    if (l.contractor_id) row.routed++
    const s = l.canonical_stage
    if (s === 'inspection' || s === 'quote_sent' || s === 'won') row.inspecties++
    if (s === 'quote_sent' || s === 'won') row.offertes++
    if (s === 'won') row.gewonnen++
  }

  return [...rowMap.values()].sort((a, b) => b.leads - a.leads)
}

// Niche-level performance for a date range. Includes ALL leads (no campaign_tag requirement).
export interface NicheRow {
  niche:      string
  leads:      number
  routed:     number
  inspecties: number
  offertes:   number
  gewonnen:   number
}

export async function nichePerformance(range?: TimeRange): Promise<NicheRow[]> {
  let leadsQ = db().from('leads')
    .select('contractor_id, board_id, canonical_stage')
    .limit(5000)
  if (range) {
    leadsQ = leadsQ
      .gte('monday_created_at', range.from.toISOString())
      .lte('monday_created_at', range.to.toISOString())
  }

  const [{ data: leads }, { data: boardConfigs }, { data: contractors }] = await Promise.all([
    leadsQ,
    db().from('boards_config').select('id, niche'),
    db().from('contractors').select('id, niche, active'),
  ])

  const boardNiche      = new Map<number, string>((boardConfigs ?? []).filter(b => b.niche).map(b => [b.id, b.niche!]))
  const contractorNiche = new Map<string, string>((contractors ?? []).filter(c => c.niche).map(c => [c.id, c.niche!]))
  const activeIds       = new Set((contractors ?? []).filter(c => c.active).map(c => c.id))

  const rowMap = new Map<string, NicheRow>()

  for (const l of leads ?? []) {
    // Only count leads that belong to an active contractor, or to a board with a known niche
    const leadNiche = l.contractor_id
      ? (contractorNiche.get(l.contractor_id) ?? null)
      : (boardNiche.get(l.board_id) ?? null)

    if (!leadNiche) continue
    // If routed, must be to an active contractor
    if (l.contractor_id && !activeIds.has(l.contractor_id)) continue

    if (!rowMap.has(leadNiche)) {
      rowMap.set(leadNiche, { niche: leadNiche, leads: 0, routed: 0, inspecties: 0, offertes: 0, gewonnen: 0 })
    }
    const row = rowMap.get(leadNiche)!
    row.leads++
    if (l.contractor_id) row.routed++
    const s = l.canonical_stage
    if (s === 'inspection' || s === 'quote_sent' || s === 'won') row.inspecties++
    if (s === 'quote_sent' || s === 'won') row.offertes++
    if (s === 'won') row.gewonnen++
  }

  return [...rowMap.values()].sort((a, b) => b.leads - a.leads)
}

// Business-wide average days between stage transitions for a period.
export interface DoorlooptijdenAggregate {
  leadToInspection:  number | null
  inspectionToQuote: number | null
  quoteToWon:        number | null
}

export async function doorlooptijdenAggregate(range: TimeRange): Promise<DoorlooptijdenAggregate> {
  const contractors = await getActiveContractors()
  const activeIds   = contractors.map(c => c.id)

  const [leadToInspection, inspectionToQuote, quoteToWon] = await Promise.all([
    avgDaysBetweenTransitionsCore(activeIds, STAGE_STATUSES.new,        STAGE_STATUSES.inspection, range),
    avgDaysBetweenTransitionsCore(activeIds, STAGE_STATUSES.inspection,  STAGE_STATUSES.quote_sent, range),
    avgDaysBetweenTransitionsCore(activeIds, STAGE_STATUSES.quote_sent,  STAGE_STATUSES.won,        range),
  ])

  return { leadToInspection, inspectionToQuote, quoteToWon }
}

// ── Open offertes stats ───────────────────────────────────────────────────────
// Counts quote_sent leads; distinguishes full_sales contractors (where aanneemsom matters).
//
// TODO — Aanneemsom activation sequence (do after adding Monday columns):
//   1. In Monday, add a numeric "Aanneemsom" column to boards for:
//      Hollands Prefab, Bouwcombinatie Amsterdam, Prefab Op Maat, T-Bouw, Flair, Vastgoed Groep
//   2. Update boards_config.column_map for each board with the new column ID
//   3. Add quote_amount to the lead sync field projection in the sync engine
//   4. Re-sync all 6 boards (syncBoard per board_id)
//   5. Verify: SELECT COUNT(*), AVG(quote_amount) FROM leads WHERE canonical_stage='quote_sent'
//      AND quote_amount > 0 — should see data for full_sales contractors
//   6. Swap "Open offertes" StatCard hero back to € value using sum of quote_amount

export interface OpenOffertesStats {
  total:          number   // all quote_sent leads (active contractors)
  fullSalesCount: number   // subset: full_sales service_model only
}

export async function openOffertesStats(): Promise<OpenOffertesStats> {
  const contractors  = await getActiveContractors()
  const allIds       = contractors.map(c => c.id)
  const fullSalesIds = contractors.filter(c => c.service_model === 'full_sales').map(c => c.id)

  const [{ count: total }, { count: fullSalesCount }] = await Promise.all([
    db().from('leads').select('*', { count: 'exact', head: true })
      .eq('canonical_stage', 'quote_sent').in('contractor_id', allIds),
    db().from('leads').select('*', { count: 'exact', head: true })
      .eq('canonical_stage', 'quote_sent').in('contractor_id', fullSalesIds),
  ])

  return { total: total ?? 0, fullSalesCount: fullSalesCount ?? 0 }
}
