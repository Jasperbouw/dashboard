import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'
import { UNROUTED_BACKLOG_COUNT, UNROUTED_BACKLOG_HOURS } from '../thresholds'

export async function unroutedLeadsBacklogAlerts(): Promise<AlertInput[]> {
  const db = serverClient()
  const cutoff = new Date(Date.now() - UNROUTED_BACKLOG_HOURS * 60 * 60 * 1000).toISOString()

  const { data: oldest, error: oldestErr } = await db
    .from('leads')
    .select('monday_created_at')
    .is('contractor_id', null)
    .lt('monday_created_at', cutoff)
    .order('monday_created_at', { ascending: true })
    .limit(1)
    .single()

  if (oldestErr && oldestErr.code !== 'PGRST116') throw new Error(`unroutedLeadsBacklogAlerts: ${oldestErr.message}`)
  if (!oldest) return []

  const { count, error } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .is('contractor_id', null)
    .lt('monday_created_at', cutoff)

  if (error) throw new Error(`unroutedLeadsBacklogAlerts: ${error.message}`)

  if ((count ?? 0) < UNROUTED_BACKLOG_COUNT) return []

  return [{
    type:             'unrouted_leads_backlog',
    severity:         'warning',
    title:            `${count} niet-gekoppelde leads`,
    body:             `${count} leads ouder dan ${UNROUTED_BACKLOG_HOURS}u hebben geen aannemer toegewezen.`,
    issue_started_at: oldest.monday_created_at ?? null,
    meta:             { count, hours: UNROUTED_BACKLOG_HOURS },
  }]
}
