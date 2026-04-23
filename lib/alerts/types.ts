export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface AlertInput {
  type:              string
  severity:          AlertSeverity
  contractor_id?:    string | null
  lead_id?:          string | null
  title:             string
  body:              string
  meta?:             Record<string, unknown>
  issue_started_at?: string | null   // ISO — when the underlying condition began
}

export interface AlertRow {
  id:               string
  type:             string
  severity:         AlertSeverity
  contractor_id:    string | null
  lead_id:          string | null
  title:            string
  body:             string
  natural_key:      string
  triggered_at:     string
  resolved_at:      string | null
  dismissed_at:     string | null
  issue_started_at: string | null
  meta:             Record<string, unknown>
}

/** Deterministic deduplication key for an alert. */
export function naturalKey(input: Pick<AlertInput, 'type' | 'lead_id' | 'contractor_id'>): string {
  if (input.lead_id)        return `${input.type}::lead::${input.lead_id}`
  if (input.contractor_id)  return `${input.type}::contractor::${input.contractor_id}`
  return `${input.type}::global`
}
