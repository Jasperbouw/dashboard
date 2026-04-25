import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME  = 'bouwcheck_auth'
const MAX_AGE_SEC  = 30 * 24 * 60 * 60 // 30 days

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const expected = process.env.DASHBOARD_PASSWORD
  const secret   = process.env.AUTH_SECRET

  if (!expected || !secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Timing-safe password comparison
  const pwBuf  = Buffer.from(password ?? '')
  const expBuf = Buffer.from(expected)
  const match  =
    pwBuf.length === expBuf.length &&
    timingSafeEqual(pwBuf, expBuf)

  if (!match) {
    return NextResponse.json({ error: 'Ongeldig wachtwoord' }, { status: 401 })
  }

  // Build signed cookie value: "{timestamp}.{hmac}"
  const timestamp   = Date.now()
  const sig         = createHmac('sha256', secret).update(`${password}.${timestamp}`).digest('hex')
  const cookieValue = `${timestamp}.${sig}`

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === 'production',
    sameSite:  'lax',
    maxAge:    MAX_AGE_SEC,
    path:      '/',
  })
  return res
}
