import { serverClient } from '../../supabase-server'
import { type AlertInput } from '../types'

export async function retainerAtRiskAlerts(): Promise<AlertInput[]> {
  const db = serverClient()

  const { data, error } = await db
    .from('contractors')
    .select('id, name, monthly_retainer_fee, monthly_ad_budget, retainer_billing')
    .eq('commission_model', 'retainer')
    .eq('relationship_status', 'at_risk')
    .eq('active', true)

  if (error) throw new Error(`retainerAtRiskAlerts: ${error.message}`)

  return (data ?? []).map(c => ({
    type:          'retainer_at_risk',
    severity:      'warning' as const,
    contractor_id: c.id,
    title:         `Retainer at risk: ${c.name}`,
    body:          `Klantrelatie heeft status "at_risk". Actie vereist om retainer te behouden.`,
    meta:          { monthly_retainer_fee: c.monthly_retainer_fee, monthly_ad_budget: c.monthly_ad_budget, retainer_billing: c.retainer_billing },
  }))
}
