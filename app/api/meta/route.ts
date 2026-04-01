import { NextResponse } from 'next/server'

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID

export async function GET() {
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    return NextResponse.json({ error: 'not_configured' })
  }

  try {
    const fields = [
      'name',
      'status',
      'daily_budget',
      'lifetime_budget',
      'insights.date_preset(this_month){spend,impressions,clicks,reach,frequency,cpm,actions,cost_per_action_type}',
    ].join(',')

    const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/campaigns?fields=${encodeURIComponent(fields)}&limit=50&access_token=${ACCESS_TOKEN}`
    const res = await fetch(url, { cache: 'no-store' })
    const json = await res.json()

    if (json.error) {
      return NextResponse.json({ error: json.error.message })
    }

    const campaigns = (json.data || []).map((c: any) => {
      const ins = c.insights?.data?.[0] ?? {}
      const actions: any[] = ins.actions ?? []
      const costPerAction: any[] = ins.cost_per_action_type ?? []
      const leads = parseInt(actions.find((a: any) => a.action_type === 'lead')?.value ?? '0')
      const cplRaw = costPerAction.find((a: any) => a.action_type === 'lead')?.value
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        dailyBudget: c.daily_budget ? parseInt(c.daily_budget) / 100 : null,
        spend: parseFloat(ins.spend ?? '0'),
        impressions: parseInt(ins.impressions ?? '0'),
        clicks: parseInt(ins.clicks ?? '0'),
        reach: parseInt(ins.reach ?? '0'),
        frequency: parseFloat(ins.frequency ?? '0'),
        cpm: parseFloat(ins.cpm ?? '0'),
        leads,
        cpl: cplRaw ? parseFloat(cplRaw) : null,
        ctr: ins.impressions > 0 ? (parseInt(ins.clicks ?? '0') / parseInt(ins.impressions)) * 100 : 0,
      }
    })

    return NextResponse.json({ campaigns })
  } catch (err) {
    return NextResponse.json({ error: String(err) })
  }
}
