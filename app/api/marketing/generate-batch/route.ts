import { NextRequest, NextResponse } from 'next/server'
import { generateDailyBatch } from '../../../../lib/marketing/generate-batch'

// Manual trigger requires x-sync-secret header.
// Vercel Cron fires with Authorization: Bearer <CRON_SECRET>.
function isAuthorized(req: NextRequest): boolean {
  const syncSecret = req.headers.get('x-sync-secret')
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true
  const auth = req.headers.get('authorization')
  if (auth && process.env.CRON_SECRET) {
    const token = auth.replace(/^Bearer\s+/i, '')
    if (token === process.env.CRON_SECRET) return true
  }
  return false
}

// Vercel Cron max duration: 300s on Pro plan.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await generateDailyBatch()
    return NextResponse.json({
      ok:        true,
      batchId:   result.batchId,
      creatives: result.creatives,
      errors:    result.errors,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// Vercel Cron fires GET — proxy to POST
export async function GET(req: NextRequest) {
  return POST(req)
}
