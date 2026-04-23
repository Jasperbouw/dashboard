import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'
import { filterApplicableContractors } from '../utils'
import { closeRate, currentMonth } from '../../metrics'
import { LOW_CLOSE_RATE_PCT, LOW_CLOSE_RATE_MIN_QUOTES } from '../thresholds'

export async function lowCloseRateAlerts(): Promise<AlertInput[]> {
  const db = serverClient()
  const range = currentMonth()

  const { data: contractors } = await db
    .from('contractors')
    .select('id, name, service_model, qualification_model')
    .eq('active', true)

  const applicable = filterApplicableContractors(contractors ?? [], 'low_close_rate')
  if (!applicable.length) return []

  const results: AlertInput[] = []

  await Promise.all(applicable.map(async (c) => {
    const { count: quoteCount } = await db
      .from('lead_status_changes')
      .select('id, leads!inner(contractor_id)', { count: 'exact', head: true })
      .eq('leads.contractor_id', c.id)
      .eq('to_status', 'quote_sent')
      .gte('changed_at', range.from.toISOString())
      .lte('changed_at', range.to.toISOString())

    if ((quoteCount ?? 0) < LOW_CLOSE_RATE_MIN_QUOTES) return

    const rate = await closeRate(c.id, range)
    if (rate == null || rate >= LOW_CLOSE_RATE_PCT) return

    results.push({
      type:          'low_close_rate',
      severity:      'critical',
      contractor_id: c.id,
      title:         `Lage sluitingsratio: ${c.name}`,
      body:          `Sluitingsratio ${rate}% (min. ${LOW_CLOSE_RATE_MIN_QUOTES} offertes verstuurd deze maand).`,
      meta:          { rate, quoteCount, threshold: LOW_CLOSE_RATE_PCT },
    })
  }))

  return results
}
