import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  await fetch('https://hooks.zapier.com/hooks/catch/23679605/u7ao1c2/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return NextResponse.json({ ok: true })
}
