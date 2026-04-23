import { serverClient } from '../supabase-server'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface EnrichedAlert {
  id:               string
  type:             string
  severity:         AlertSeverity
  title:            string
  body:             string
  natural_key:      string
  triggered_at:     string
  dismissed_at:     string | null
  issue_started_at: string | null
  contractor_id:    string | null
  lead_id:          string | null
  meta:             Record<string, unknown>
  contractor:       { id: string; name: string } | null
  lead:             { id: string; contact_name: string | null } | null
}

export async function getActiveAlerts(
  opts: { severity?: AlertSeverity; limit?: number } = {},
): Promise<EnrichedAlert[]> {
  const db = serverClient()
  const { severity, limit = 100 } = opts

  let query = db
    .from('alerts')
    .select(`
      id, type, severity, title, body, natural_key,
      triggered_at, dismissed_at, issue_started_at, meta,
      contractor_id, lead_id,
      contractors(id, name),
      leads(id, contact_name)
    `)
    .is('resolved_at', null)
    .is('dismissed_at', null)
    .order('severity')           // critical < info < warning (alphabetical — sort in JS)
    .order('triggered_at', { ascending: false })
    .limit(limit)

  if (severity) query = query.eq('severity', severity)

  const { data, error } = await query
  if (error) throw new Error(`getActiveAlerts: ${error.message}`)

  const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }

  return ((data ?? []) as any[])
    .map(row => ({
      id:               row.id,
      type:             row.type,
      severity:         row.severity as AlertSeverity,
      title:            row.title,
      body:             row.body,
      natural_key:      row.natural_key,
      triggered_at:     row.triggered_at,
      dismissed_at:     row.dismissed_at,
      issue_started_at: row.issue_started_at ?? null,
      contractor_id:    row.contractor_id,
      lead_id:          row.lead_id,
      meta:             row.meta ?? {},
      contractor:       row.contractors ?? null,
      lead:             row.leads ?? null,
    }))
    .sort((a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99) ||
      new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
    )
}
