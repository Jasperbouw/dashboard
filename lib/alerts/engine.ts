import { serverClient } from '../supabase-server'
import { type AlertInput, type AlertRow, naturalKey } from './types'
import { staleQuoteAlerts }           from './rules/stale-quote'
import { overdueFollowupAlerts }      from './rules/overdue-followup'
import { lowCloseRateAlerts }         from './rules/low-close-rate'
import { slowLeadProcessingAlerts }   from './rules/slow-lead-processing'
import { agingQuoteAlerts }           from './rules/aging-quote'
import { lowQualificationAlerts }     from './rules/low-qualification'
import { followupDueTodayAlerts }     from './rules/followup-due-today'
import { unroutedLeadsBacklogAlerts } from './rules/unrouted-leads-backlog'
import { newDealWonAlerts }           from './rules/new-deal-won'
import { newQuoteSentAlerts }         from './rules/new-quote-sent'
import { packMilestoneAlerts }        from './rules/pack-milestone'
import { retainerAtRiskAlerts }      from './rules/retainer-at-risk'

export interface AlertsRunResult {
  triggered: number
  resolved:  number
  updated:   number
  errors:    string[]
}

export async function runAlerts(): Promise<AlertsRunResult> {
  const db = serverClient()
  const errors: string[] = []

  // Run all rules in parallel; collect results, swallowing individual rule failures
  const ruleResults = await Promise.all([
    staleQuoteAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    overdueFollowupAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    lowCloseRateAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    slowLeadProcessingAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    agingQuoteAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    lowQualificationAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    followupDueTodayAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    unroutedLeadsBacklogAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    newDealWonAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    newQuoteSentAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    packMilestoneAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
    retainerAtRiskAlerts().catch(e => { errors.push(e.message); return [] as AlertInput[] }),
  ])

  const incoming = ruleResults.flat()

  // Build map of natural_key → input for fast lookup
  const incomingByKey = new Map<string, AlertInput>()
  for (const alert of incoming) {
    const key = naturalKey(alert)
    incomingByKey.set(key, alert)
  }

  // Fetch all currently active (non-resolved) alerts
  const { data: existing, error: fetchErr } = await db
    .from('alerts')
    .select('*')
    .is('resolved_at', null)

  if (fetchErr) throw new Error(`runAlerts fetch: ${fetchErr.message}`)

  const existingRows = (existing ?? []) as AlertRow[]
  const existingByKey = new Map<string, AlertRow>()
  for (const row of existingRows) {
    existingByKey.set(row.natural_key, row)
  }

  const now = new Date().toISOString()
  let triggered = 0
  let resolved  = 0
  let updated   = 0

  // Resolve alerts that are no longer applicable
  const toResolve = existingRows
    .filter(r => !incomingByKey.has(r.natural_key) && r.dismissed_at == null)
    .map(r => r.id)

  if (toResolve.length > 0) {
    const { error: resolveErr } = await db
      .from('alerts')
      .update({ resolved_at: now })
      .in('id', toResolve)
    if (resolveErr) errors.push(`resolve: ${resolveErr.message}`)
    else resolved = toResolve.length
  }

  // Upsert new/updated alerts
  const toUpsert = []
  for (const [key, input] of incomingByKey) {
    const existing = existingByKey.get(key)
    toUpsert.push({
      type:             input.type,
      severity:         input.severity,
      contractor_id:    input.contractor_id ?? null,
      lead_id:          input.lead_id ?? null,
      title:            input.title,
      body:             input.body,
      natural_key:      key,
      triggered_at:     existing?.triggered_at ?? now,
      resolved_at:      null,
      dismissed_at:     existing?.dismissed_at ?? null,
      issue_started_at: existing?.issue_started_at ?? input.issue_started_at ?? null,
      meta:             input.meta ?? {},
    })
  }

  if (toUpsert.length > 0) {
    const { error: upsertErr } = await db
      .from('alerts')
      .upsert(toUpsert, { onConflict: 'natural_key' })

    if (upsertErr) errors.push(`upsert: ${upsertErr.message}`)
    else {
      const existingKeys = new Set(existingByKey.keys())
      for (const row of toUpsert) {
        if (existingKeys.has(row.natural_key)) updated++
        else triggered++
      }
    }
  }

  return { triggered, resolved, updated, errors }
}
