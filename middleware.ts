import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'bouwcheck_auth'
const MAX_AGE_MS  = 30 * 24 * 60 * 60 * 1000 // 30 days

// Prefixes that bypass auth entirely
const PUBLIC = [
  '/login',
  '/api/auth/',
  '/api/sync/',                       // Vercel cron + manual sync (uses CRON_SECRET/x-sync-secret)
  '/api/marketing/generate-batch',    // Vercel cron + dashboard trigger (own auth check)
  '/api/energie-lead/', // Webhook receivers
  '/api/leadbyte/',
  '/_next/',
]

function isPublic(pathname: string): boolean {
  return PUBLIC.some(p => pathname === p || pathname.startsWith(p))
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function computeHmac(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return bufToHex(sig)
}

async function verifyCookie(value: string, password: string, secret: string): Promise<boolean> {
  const dot = value.indexOf('.')
  if (dot === -1) return false

  const ts  = parseInt(value.slice(0, dot), 10)
  const sig = value.slice(dot + 1)

  if (isNaN(ts) || Date.now() - ts > MAX_AGE_MS) return false

  const expected = await computeHmac(`${password}.${ts}`, secret)

  // Timing-safe character-by-character comparison
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  }
  return diff === 0
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const password = process.env.DASHBOARD_PASSWORD
  const secret   = process.env.AUTH_SECRET

  if (!password || !secret) {
    // Misconfigured: block in production, allow in dev
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value
  if (cookie && (await verifyCookie(cookie, password, secret))) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', req.url)
  if (pathname !== '/') loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    // Match everything except static files
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf)).*)',
  ],
}
