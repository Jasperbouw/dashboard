const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: Request) {
  const body = await req.json()

  const res = await fetch(
    'https://leadkoning.leadbyte.co.uk/restapi/v1.31/custom/69ce8a272e159',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  const data = await res.json()
  return Response.json(data, { headers: CORS_HEADERS })
}
