const MONDAY_API_URL = 'https://api.monday.com/v2'

export interface MondayError {
  message: string
  locations?: { line: number; column: number }[]
  path?: string[]
  extensions?: Record<string, unknown>
}

export interface MondayResponse<T> {
  data: T
  errors?: MondayError[]
  account_id?: number
}

export async function mondayQuery<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiKey = process.env.MONDAY_API_KEY
  if (!apiKey) throw new Error('MONDAY_API_KEY is not set')

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Monday API HTTP ${res.status}: ${await res.text()}`)
  }

  const json: MondayResponse<T> = await res.json()

  if (json.errors?.length) {
    const msg = json.errors.map(e => e.message).join('; ')
    throw new Error(`Monday API error: ${msg}`)
  }

  return json.data
}
