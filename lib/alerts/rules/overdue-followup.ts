import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'
import { filterApplicableContractors } from '../utils'

export async function overdueFollowupAlerts(): Promise<AlertInput[]> {
  const db = serverClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: contractors } = await db
    .from('contractors')
    .select('id, service_model, qualification_model')
    .eq('active', true)

  const applicableIds = filterApplicableContractors(contractors ?? [], 'overdue_followup').map(c => c.id)
  if (!applicableIds.length) return []

  const { data, error } = await db
    .from('leads')
    .select('id, contact_name, contractor_id, follow_up_date')
    .lt('follow_up_date', today)
    .not('canonical_stage', 'in', '("won","lost")')
    .in('contractor_id', applicableIds)

  if (error) throw new Error(`overdueFollowupAlerts: ${error.message}`)

  return (data ?? []).map(lead => ({
    type:             'overdue_followup',
    severity:         'critical' as const,
    lead_id:          lead.id,
    contractor_id:    lead.contractor_id,
    title:            `Opvolging te laat: ${lead.contact_name ?? 'onbekend'}`,
    body:             `Follow-up datum (${lead.follow_up_date}) is verstreken.`,
    issue_started_at: lead.follow_up_date ? new Date(lead.follow_up_date).toISOString() : null,
    meta:             { follow_up_date: lead.follow_up_date },
  }))
}
