import { NextResponse } from 'next/server'
import { lastSyncRun } from '../../../../lib/monday-sync'

export async function GET() {
  try {
    const run = await lastSyncRun()
    return NextResponse.json({ ok: true, run })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
