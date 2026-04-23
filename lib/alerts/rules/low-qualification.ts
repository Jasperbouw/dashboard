import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'
import { filterApplicableContractors } from '../utils'
import { qualificationRate, leadsReceived, currentMonth } from '../../metrics'
import { LOW_QUAL_RATE_PCT, LOW_QUAL_RATE_MIN_LEADS } from '../thresholds'

export async function lowQualificationAlerts(): Promise<AlertInput[]> {
  const db = serverClient()
  const range = currentMonth()

  const { data: contractors } = await db
    .from('contractors')
    .select('id, name, service_model, qualification_model')
    .eq('active', true)

  const applicable = filterApplicableContractors(contractors ?? [], 'low_qualification_rate')
  if (!applicable.length) return []

  const results: AlertInput[] = []

  await Promise.all(applicable.map(async (c) => {
    const [leads, rate] = await Promise.all([
      leadsReceived(c.id, range),
      qualificationRate(c.id, range),
    ])

    if (leads < LOW_QUAL_RATE_MIN_LEADS || rate == null || rate >= LOW_QUAL_RATE_PCT) return

    results.push({
      type:          'low_qualification_rate',
      severity:      'warning',
      contractor_id: c.id,
      title:         `Lage kwalificatieratio: ${c.name}`,
      body:          `Kwalificatieratio ${rate}% (min. ${LOW_QUAL_RATE_MIN_LEADS} leads deze maand).`,
      meta:          { rate, leads, threshold: LOW_QUAL_RATE_PCT },
    })
  }))

  return results
}
