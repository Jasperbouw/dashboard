import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'bouwcheck_auth'
const MAX_AGE_MS  = 30 * 24 * 60 * 60 * 1000 // 30 days

export function verifyDashboardCookie(req: NextRequest): boolean {
  const password = process.env.DASHBOARD_PASSWORD
  const secret   = process.env.AUTH_SECRET
  if (!password || !secret) return false

  const value = req.cookies.get(COOKIE_NAME)?.value
  if (!value) return false

  const dot = value.indexOf('.')
  if (dot === -1) return false

  const ts  = parseInt(value.slice(0, dot), 10)
  const sig = value.slice(dot + 1)

  if (isNaN(ts) || Date.now() - ts > MAX_AGE_MS) return false

  const expected = createHmac('sha256', secret).update(`${password}.${ts}`).digest('hex')

  if (expected.length !== sig.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
}
