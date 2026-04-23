import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'
import { filterApplicableContractors, isLeadDeferredByFollowUp } from '../utils'
import { STALE_QUOTE_DAYS } from '../thresholds'

export async function staleQuoteAlerts(): Promise<AlertInput[]> {
  const db = serverClient()
  const cutoff = new Date(Date.now() - STALE_QUOTE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: contractors } = await db
    .from('contractors')
    .select('id, service_model, qualification_model')
    .eq('active', true)

  const applicableIds = filterApplicableContractors(contractors ?? [], 'stale_quote').map(c => c.id)
  if (!applicableIds.length) return []

  const { data, error } = await db
    .from('leads')
    .select('id, contact_name, contractor_id, monday_updated_at, follow_up_date')
    .eq('canonical_stage', 'quote_sent')
    .lt('monday_updated_at', cutoff)
    .in('contractor_id', applicableIds)

  if (error) throw new Error(`staleQuoteAlerts: ${error.message}`)

  return (data ?? []).filter(lead => !isLeadDeferredByFollowUp(lead)).map(lead => ({
    type:             'stale_quote',
    severity:         'critical' as const,
    lead_id:          lead.id,
    contractor_id:    lead.contractor_id,
    title:            `Offerte verlopen: ${lead.contact_name ?? 'onbekend'}`,
    body:             `Offerte staat al meer dan ${STALE_QUOTE_DAYS} dagen open zonder update.`,
    issue_started_at: lead.monday_updated_at,
    meta:             { monday_updated_at: lead.monday_updated_at },
  }))
}
