import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'
import { filterApplicableContractors, isLeadDeferredByFollowUp } from '../utils'
import { SLOW_LEAD_HOURS } from '../thresholds'

export async function slowLeadProcessingAlerts(): Promise<AlertInput[]> {
  const db = serverClient()
  const cutoff      = new Date(Date.now() - SLOW_LEAD_HOURS * 60 * 60 * 1000).toISOString()
  const maxAgeCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: contractors } = await db
    .from('contractors')
    .select('id, service_model, qualification_model')
    .eq('active', true)

  // fires for full_sales + leads_only (lead routing is always our job)
  const applicableIds = filterApplicableContractors(contractors ?? [], 'slow_lead_processing').map(c => c.id)
  if (!applicableIds.length) return []

  const { data: candidates, error } = await db
    .from('leads')
    .select('id, contact_name, contractor_id, monday_updated_at, monday_created_at, follow_up_date')
    .eq('canonical_stage', 'new')
    .in('contractor_id', applicableIds)
    .lt('monday_updated_at', cutoff)
    .gte('monday_created_at', maxAgeCutoff)

  if (error) throw new Error(`slowLeadProcessingAlerts: ${error.message}`)
  if (!candidates?.length) return []

  const leadIds = candidates.map(l => l.id)
  const { data: recentChanges } = await db
    .from('lead_status_changes')
    .select('lead_id')
    .in('lead_id', leadIds)
    .gte('changed_at', cutoff)

  const recentlyChanged = new Set((recentChanges ?? []).map(r => r.lead_id))

  return candidates
    .filter(lead => !recentlyChanged.has(lead.id) && !isLeadDeferredByFollowUp(lead))
    .map(lead => ({
      type:             'slow_lead_processing',
      severity:         'warning' as const,
      lead_id:          lead.id,
      contractor_id:    lead.contractor_id,
      title:            `Lead niet opgepakt: ${lead.contact_name ?? 'onbekend'}`,
      body:             `Lead staat al meer dan ${SLOW_LEAD_HOURS} uur op "nieuw" zonder activiteit.`,
      issue_started_at: lead.monday_created_at,
      meta:             { monday_updated_at: lead.monday_updated_at, hours: SLOW_LEAD_HOURS },
    }))
}
