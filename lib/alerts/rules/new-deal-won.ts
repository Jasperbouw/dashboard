import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'
import { filterApplicableContractors } from '../utils'

export async function newDealWonAlerts(): Promise<AlertInput[]> {
  const db = serverClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: contractors } = await db
    .from('contractors')
    .select('id, service_model, qualification_model')
    .eq('active', true)

  const applicableIds = filterApplicableContractors(contractors ?? [], 'new_deal_won').map(c => c.id)
  if (!applicableIds.length) return []

  const { data, error } = await db
    .from('lead_status_changes')
    .select('lead_id, changed_at, leads!inner(id, contact_name, contractor_id)')
    .eq('to_status', 'won')
    .gte('changed_at', todayStart.toISOString())
    .in('leads.contractor_id', applicableIds)

  if (error) throw new Error(`newDealWonAlerts: ${error.message}`)

  return (data ?? []).map((row: any) => {
    const lead = row.leads
    return {
      type:             'new_deal_won',
      severity:         'info' as const,
      lead_id:          lead.id,
      contractor_id:    lead.contractor_id,
      title:            `Deal gewonnen: ${lead.contact_name ?? 'onbekend'}`,
      body:             'Nieuwe opdracht gewonnen vandaag.',
      issue_started_at: row.changed_at ?? null,
      meta:             {},
    }
  })
}
