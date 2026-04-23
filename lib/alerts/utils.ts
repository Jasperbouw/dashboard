// Alert applicability matrix — controls which alert types fire for which service models.
// service_model is orthogonal to commission_model: it describes our operational involvement.
//   full_sales  — we run the full funnel (calling, qualifying, quotes, follow-ups)
//   leads_only  — we deliver leads; contractor runs their own sales process
//   hands_off   — ads management retainer only; no lead involvement from us

type ServiceModel = 'full_sales' | 'leads_only' | 'hands_off' | null

const MATRIX: Record<string, ServiceModel[]> = {
  stale_quote:            ['full_sales'],
  overdue_followup:       ['full_sales'],
  slow_lead_processing:   ['full_sales'],
  aging_quote:            ['full_sales'],
  followup_due_today:     ['full_sales'],
  low_qualification_rate: ['full_sales', 'leads_only'],
  low_close_rate:         ['full_sales'],
  new_deal_won:           ['full_sales', 'leads_only'],
  new_quote_sent:         ['full_sales'],
  retainer_at_risk:       ['hands_off'],
  // unrouted_leads_backlog is not contractor-scoped — always fires
}

interface AlertFireOpts {
  qualificationModel?: string | null
}

export function shouldAlertFire(
  alertType: string,
  serviceModel: ServiceModel,
  opts: AlertFireOpts = {},
): boolean {
  const allowed = MATRIX[alertType]
  if (!allowed) return true   // unknown type — allow by default

  const sm = serviceModel ?? 'full_sales'
  if (!allowed.includes(sm as ServiceModel)) return false

  // low_qualification for leads_only: only fire if qualification_model = 'pre_qualified'
  // (unfiltered leads naturally convert low — not a signal we should act on)
  if (alertType === 'low_qualification_rate' && sm === 'leads_only') {
    return opts.qualificationModel === 'pre_qualified'
  }

  return true
}

// Returns true when a lead has a future follow_up_date — meaning the user
// has explicitly planned when to revisit it. Suppress inactivity alerts
// until end of that day; the day after, normal rules resume.
export function isLeadDeferredByFollowUp(lead: { follow_up_date?: string | null }): boolean {
  if (!lead.follow_up_date) return false
  const followUp = new Date(lead.follow_up_date)
  followUp.setHours(23, 59, 59, 999)
  return followUp > new Date()
}

// Convenience: filter a contractor list to those applicable for a given alert type
export function filterApplicableContractors<T extends {
  service_model: ServiceModel
  qualification_model?: string | null
}>(contractors: T[], alertType: string): T[] {
  return contractors.filter(c =>
    shouldAlertFire(alertType, c.service_model, { qualificationModel: c.qualification_model })
  )
}
