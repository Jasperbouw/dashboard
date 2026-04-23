import { NextRequest, NextResponse } from 'next/server'
import { syncAllBoards } from '../../../../lib/monday-sync'
import { runAlerts } from '../../../../lib/alerts/engine'
import { serverClient } from '../../../../lib/supabase-server'

function isAuthorized(req: NextRequest): boolean {
  // Manual trigger: x-sync-secret header
  const syncSecret = req.headers.get('x-sync-secret')
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true

  // Vercel Cron: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  if (authHeader && process.env.CRON_SECRET) {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (token === process.env.CRON_SECRET) return true
  }

  return false
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const syncResult = await syncAllBoards()
    const alertsResult = await runAlerts()

    if (alertsResult.triggered > 0) {
      const db = serverClient()
      const { data: latestRun } = await db
        .from('sync_runs')
        .select('id')
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      if (latestRun) {
        await db
          .from('sync_runs')
          .update({ alerts_triggered: alertsResult.triggered })
          .eq('id', latestRun.id)
      }
    }

    return NextResponse.json({
      ok: true,
      ...syncResult,
      alerts: alertsResult,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// Vercel Cron fires GET requests — proxy to POST handler
export async function GET(req: NextRequest) {
  return POST(req)
}
