import { NextResponse } from 'next/server'

const MONDAY_API_KEY = process.env.MONDAY_API_KEY
const BOARD_ID = process.env.MONDAY_LEADS_BOARD_ID

export async function GET() {
  const query = `{
    boards(ids: [${BOARD_ID}]) {
      name
      items_page(limit: 500) {
        items {
          id
          name
          created_at
          column_values {
            id
            text
          }
        }
      }
    }
  }`

  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Authorization': MONDAY_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  })

  const data = await res.json()
  const items = data.data.boards[0].items_page.items

  const leads = items.map((item: any) => {
    const col = (id: string) => item.column_values.find((c: any) => c.id === id)?.text || ''
    return {
      id: item.id,
      name: item.name,
      created_at: item.created_at,
      campagne: col('text_mm0ghcar'),
      telefoon: col('contact_phone'),
      email: col('text_mksk3arq'),
      status: col('color_mkskgdv2'),
      urgentie: col('long_text_mktfh12b'),
      dienst: col('text_mkskv446'),
      m2: col('text_mkskn3bq'),
      postcode: col('text_mksk8j3'),
    }
  })

  return NextResponse.json(leads)
}
