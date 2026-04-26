import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const { data, error } = await db
    .from('contractors')
    .select('street_address, postal_code, city, country, latitude, longitude, service_radius_km, service_provinces')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body   = await req.json()
  const db     = serverClient()

  const update: Record<string, unknown> = {}

  // Address fields — trigger geocoding when present
  const hasAddress = body.street_address !== undefined || body.city !== undefined
  if (hasAddress) {
    if (body.street_address !== undefined) update.street_address = body.street_address || null
    if (body.postal_code    !== undefined) update.postal_code    = body.postal_code    || null
    if (body.city           !== undefined) update.city           = body.city           || null
    if (body.country        !== undefined) update.country        = body.country        || 'NL'

    // Geocode using Mapbox (server-side token)
    const token   = process.env.MAPBOX_GEOCODING_TOKEN
    const address = [body.street_address, body.postal_code, body.city, body.country ?? 'NL']
      .filter(Boolean).join(', ')

    if (token && address.trim()) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&country=nl&limit=1`
        const r   = await fetch(url)
        if (r.ok) {
          const geo = await r.json()
          const feature = geo.features?.[0]
          if (feature?.center) {
            const [lng, lat] = feature.center
            update.longitude = lng
            update.latitude  = lat
          }
        }
      } catch {
        // Geocoding failed — save address text without coords
      }
    }
  }

  // Werkgebied fields
  if (body.service_radius_km  !== undefined) update.service_radius_km  = Number(body.service_radius_km) || 50
  if (body.service_provinces  !== undefined) update.service_provinces   = body.service_provinces ?? []

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await db
    .from('contractors')
    .update(update)
    .eq('id', id)
    .select('street_address, postal_code, city, country, latitude, longitude, service_radius_km, service_provinces')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
