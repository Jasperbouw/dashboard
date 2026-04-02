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
  return Response.json(data)
}
