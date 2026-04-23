import { config } from 'dotenv'
config({ path: '.env.local' })

import {
  currentMonth, previousPeriod,
  getActiveContractors,
  leadsReceived, qualifiedLeads, qualificationRate,
  inspectionsBooked, quotesSent, quotesWon, closeRate,
  avgDealSize, avgDaysToQuote, avgDaysQuoteToClose,
  pipelineValue, commissionBooked, commissionPending, overdueFollowUps,
  funnelStageDistribution, funnelTransitions, syncDataAge,
  totalPipelineValue, totalCommissionBooked, totalCommissionPending,
  unroutedLeads, contractorLeaderboard, financeSummary,
} from '../lib/metrics'
import { serverClient } from '../lib/supabase-server'

function hr(label: string) {
  console.log('\n' + '═'.repeat(72))
  console.log(' ' + label)
  console.log('═'.repeat(72))
}
function fmt(n: number | null, prefix = ''): string {
  if (n == null) return 'NULL'
  return prefix + n.toLocaleString('nl-NL')
}

async function main() {
  const range = currentMonth()
  const prev  = previousPeriod(range)

  console.log(`\nSmoke test — metrics engine`)
  console.log(`Current period : ${range.from.toISOString().slice(0,10)} → ${range.to.toISOString().slice(0,10)}`)
  console.log(`Previous period: ${prev.from.toISOString().slice(0,10)} → ${prev.to.toISOString().slice(0,10)}`)

  // ── Status changes table check ────────────────────────────────────────
  const db = serverClient()
  const { count: scCount } = await db
    .from('lead_status_changes')
    .select('*', { count: 'exact', head: true })
  console.log(`\nlead_status_changes rows: ${scCount}`)
  console.log('Note: transition-based metrics (inspections, quotes, won, avgDays) will')
  console.log('be 0/NULL until leads change status after a fresh sync.')

  // ── Business-wide ─────────────────────────────────────────────────────
  hr('1. Business-wide — funnel (current month)')

  const [distribution, transitions, dataAge] = await Promise.all([
    funnelStageDistribution(range),
    funnelTransitions(range),
    syncDataAge(),
  ])

  console.log('  Stage distribution (snapshot — where leads currently sit):')
  const STAGES = ['new','contacted','inspection','quote_sent','won','deferred','lost'] as const
  for (const s of STAGES) {
    console.log(`    ${s.padEnd(14)} ${String(distribution[s]).padStart(5)}`)
  }

  console.log(`\n  Transition-based funnel (daysOfData=${dataAge?.toFixed(1) ?? 'none'}, reliable=${transitions.reliable}):`)
  console.log('  ' + (transitions.reliable ? '' : '⚠ Rates are null — fewer than 14 days of status-change history'))
  for (const s of ['new','contacted','inspection','quote_sent','won'] as const) {
    console.log(`    ${s.padEnd(14)} ${String(transitions.stageCounts[s]).padStart(5)} leads reached this stage`)
  }
  console.log('\n  Conversion rates:')
  for (const [k, v] of Object.entries(transitions.conversionRates)) {
    console.log(`    ${k.padEnd(28)} ${v == null ? 'NULL (insufficient data)' : v + '%'}`)
  }

  // ── Business-wide totals ──────────────────────────────────────────────
  hr('2. Business-wide — commission & pipeline')
  const [pipe, commB, commP, unrouted] = await Promise.all([
    totalPipelineValue(),
    totalCommissionBooked(range),
    totalCommissionPending(),
    unroutedLeads(range),
  ])
  console.log(`  totalPipelineValue     ${fmt(pipe, '€')}`)
  console.log(`  totalCommissionBooked  ${fmt(commB, '€')}`)
  console.log(`  totalCommissionPending ${fmt(commP, '€')}`)
  console.log(`  unroutedLeads          ${unrouted}`)

  // ── Per-contractor leaderboard ────────────────────────────────────────
  hr('3. Contractor leaderboard (current month)')
  const leaderboard = await contractorLeaderboard(range)
  console.log(
    'name'.padEnd(32) + 'model'.padEnd(12) +
    'leads'.padEnd(8) + 'qualif%'.padEnd(10) +
    'comm_booked'.padEnd(14) + 'comm_pending'.padEnd(14) + 'pipeline'
  )
  console.log('-'.repeat(96))
  for (const c of leaderboard) {
    console.log(
      c.name.slice(0,31).padEnd(32) +
      (c.commission_model ?? '?').padEnd(12) +
      String(c.leadsReceived).padStart(5).padEnd(8) +
      (c.qualificationRate == null ? 'NULL' : c.qualificationRate + '%').padEnd(10) +
      fmt(c.commissionBooked, '€').padEnd(14) +
      fmt(c.commissionPending, '€').padEnd(14) +
      fmt(c.pipelineValueEst, '€')
    )
  }

  // ── Per-contractor detail (all metrics) ───────────────────────────────
  hr('4. Per-contractor detailed metrics (current month)')
  const contractors = await getActiveContractors()
  for (const c of contractors) {
    const [
      lr, ql, qr, insp, qs, qw, cr, ads, adq, adqc, pv, cb, cp, ofu
    ] = await Promise.all([
      leadsReceived(c.id, range),
      qualifiedLeads(c.id, range),
      qualificationRate(c.id, range),
      inspectionsBooked(c.id, range),
      quotesSent(c.id, range),
      quotesWon(c.id, range),
      closeRate(c.id, range),
      avgDealSize(c.id, range),
      avgDaysToQuote(c.id, range),
      avgDaysQuoteToClose(c.id, range),
      pipelineValue(c.id),
      commissionBooked(c.id, range),
      commissionPending(c.id),
      overdueFollowUps(c.id),
    ])
    console.log(`\n  ${c.name} [${c.commission_model ?? '?'} / ${c.qualification_model ?? '?'}]`)
    console.log(`    leadsReceived       ${lr}`)
    console.log(`    qualifiedLeads      ${ql}  (${qr ?? 'NULL'}%)`)
    console.log(`    inspectionsBooked   ${insp}`)
    console.log(`    quotesSent          ${qs}`)
    console.log(`    quotesWon           ${qw}`)
    console.log(`    closeRate           ${cr ?? 'NULL'}%`)
    console.log(`    avgDealSize         ${fmt(ads, '€')}`)
    console.log(`    avgDaysToQuote      ${adq ?? 'NULL'} days`)
    console.log(`    avgDaysQuoteToClose ${adqc ?? 'NULL'} days`)
    console.log(`    pipelineValue       ${fmt(pv, '€')}`)
    console.log(`    commissionBooked    ${fmt(cb, '€')}`)
    console.log(`    commissionPending   ${fmt(cp, '€')}`)
    console.log(`    overdueFollowUps    ${ofu}`)
  }

  // ── Finance breakdown ─────────────────────────────────────────────────
  hr('5. Finance — by commission model (current month)')
  const finance = await financeSummary(range)
  console.log('\n  Percentage deals:')
  console.log(`    contractors: ${finance.percentage.contractors.join(', ') || '(none)'}`)
  console.log(`    projects:    ${finance.percentage.projectCount}`)
  console.log(`    booked:      ${fmt(finance.percentage.commissionBooked, '€')}`)
  console.log(`    pending:     ${fmt(finance.percentage.commissionPending, '€')}`)
  console.log('\n  Flat fee deals:')
  console.log(`    contractors: ${finance.flat_fee.contractors.join(', ') || '(none)'}`)
  console.log(`    projects:    ${finance.flat_fee.projectCount}`)
  console.log(`    rate/deal:   ${fmt(finance.flat_fee.ratePerDeal, '€')}`)
  console.log(`    booked:      ${fmt(finance.flat_fee.commissionBooked, '€')}`)
  console.log(`    pending:     ${fmt(finance.flat_fee.commissionPending, '€')}`)
  console.log('\n  Totals:')
  console.log(`    booked:      ${fmt(finance.totals.booked, '€')}`)
  console.log(`    pending:     ${fmt(finance.totals.pending, '€')}`)

  console.log('\n✓ Smoke test complete')
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
