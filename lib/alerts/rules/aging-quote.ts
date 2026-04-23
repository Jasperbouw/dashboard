import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'
import { filterApplicableContractors, isLeadDeferredByFollowUp } from '../utils'
import { AGING_QUOTE_MIN_DAYS, STALE_QUOTE_DAYS } from '../thresholds'

export async function agingQuoteAlerts(): Promise<AlertInput[]> {
  const db = serverClient()
  const now        = Date.now()
  const minCutoff  = new Date(now - STALE_QUOTE_DAYS    * 24 * 60 * 60 * 1000).toISOString()
  const maxCutoff  = new Date(now - AGING_QUOTE_MIN_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: contractors } = await db
    .from('contractors')
    .select('id, service_model, qualification_model')
    .eq('active', true)

  const applicableIds = filterApplicableContractors(contractors ?? [], 'aging_quote').map(c => c.id)
  if (!applicableIds.length) return []

  const { data, error } = await db
    .from('leads')
    .select('id, contact_name, contractor_id, monday_updated_at, follow_up_date')
    .eq('canonical_stage', 'quote_sent')
    .gte('monday_updated_at', minCutoff)
    .lt('monday_updated_at', maxCutoff)
    .in('contractor_id', applicableIds)

  if (error) throw new Error(`agingQuoteAlerts: ${error.message}`)

  return (data ?? []).filter(lead => !isLeadDeferredByFollowUp(lead)).map(lead => ({
    type:             'aging_quote',
    severity:         'warning' as const,
    lead_id:          lead.id,
    contractor_id:    lead.contractor_id,
    title:            `Offerte verouderd: ${lead.contact_name ?? 'onbekend'}`,
    body:             `Offerte staat ${AGING_QUOTE_MIN_DAYS}–${STALE_QUOTE_DAYS} dagen open zonder update.`,
    issue_started_at: lead.monday_updated_at,
    meta:             { monday_updated_at: lead.monday_updated_at },
  }))
}
