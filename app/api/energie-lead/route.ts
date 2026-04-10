import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) {
    params.append(key, String(value))
  }

  await fetch('https://hooks.zapier.com/hooks/catch/23679605/u7ao1c2/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  return NextResponse.json({ ok: true })
}
