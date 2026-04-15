import { NextRequest, NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

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

  return NextResponse.json({ ok: true }, { headers: CORS })
}
