import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'

export async function packMilestoneAlerts(): Promise<AlertInput[]> {
  const db  = serverClient()
  const now = new Date()

  const { data: packs, error } = await db
    .from('lead_packs')
    .select('id, contractor_id, niche, pack_type, units_promised, units_used, started_at, completed_at, status, updated_at')
    .eq('status', 'active')

  if (error) throw new Error(`packMilestoneAlerts: ${error.message}`)
  if (!packs?.length) return []

  const alerts: AlertInput[] = []
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000)

  for (const pack of packs) {
    const contractorId = pack.contractor_id
    const naturalBase  = { contractor_id: contractorId }

    let used     = Number(pack.units_used)
    const promised = Number(pack.units_promised)

    // For lead_based, calculate live count from leads table
    if (pack.pack_type === 'lead_based') {
      const q = db
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('contractor_id', contractorId)
        .eq('niche', pack.niche)
        .gte('received_at', pack.started_at)

      if (pack.completed_at) q.lte('received_at', pack.completed_at)
      const { count } = await q
      used = count ?? 0
    }

    const pct = promised > 0 ? used / promised : 0

    // 1. Pakket bijna op — >= 80% used
    if (pct >= 0.8 && pct < 1.0) {
      alerts.push({
        type:           `pack_almost_full::${pack.id}`,
        severity:       'warning',
        contractor_id:  contractorId,
        title:          `Pakket bijna op — ${pack.niche}`,
        body:           `${Math.round(pct * 100)}% gebruikt (${pack.pack_type === 'budget_based' ? `€${used.toLocaleString('nl-NL')} van €${promised.toLocaleString('nl-NL')}` : `${used} van ${promised} leads`}). Tijd voor verlenging.`,
        meta:           { pack_id: pack.id, pct: Math.round(pct * 100), niche: pack.niche },
      })
    }

    // 2. Pakket gestopt — >= 100% used
    if (pct >= 1.0) {
      alerts.push({
        type:           `pack_full::${pack.id}`,
        severity:       'critical',
        contractor_id:  contractorId,
        title:          `Pakket vol — ${pack.niche}`,
        body:           `100% bereikt. Markeer pakket als voltooid of verleng direct.`,
        meta:           { pack_id: pack.id, niche: pack.niche },
      })
    }

    // 3. Pakket inactief — < 5% progress in last 7 days (for budget_based only, since lead_based is live-counted)
    if (pack.pack_type === 'budget_based' && pct < 0.05 && new Date(pack.updated_at) < sevenDaysAgo) {
      alerts.push({
        type:           `pack_inactive::${pack.id}`,
        severity:       'info',
        contractor_id:  contractorId,
        title:          `Pakket inactief — ${pack.niche}`,
        body:           `Geen spend-update ontvangen in de laatste 7 dagen. Klopt het budget nog?`,
        meta:           { pack_id: pack.id, niche: pack.niche },
      })
    }
  }

  return alerts
}
