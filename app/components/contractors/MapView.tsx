'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

function circleGeoJSON(lng: number, lat: number, radiusKm: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const points = 64
  const coords: [number, number][] = []
  const R = 6371 // Earth radius km
  const latRad = (lat * Math.PI) / 180
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI
    const dLat = (radiusKm / R) * (180 / Math.PI) * Math.cos(angle)
    const dLng = (radiusKm / R) * (180 / Math.PI) * Math.sin(angle) / Math.cos(latRad)
    coords.push([lng + dLng, lat + dLat])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } }
}

function radiusToZoom(km: number): number {
  if (km <= 20)  return 10
  if (km <= 50)  return 9
  if (km <= 100) return 8
  if (km <= 200) return 7
  return 6
}

interface Props {
  lat:       number
  lng:       number
  radiusKm:  number
  name:      string
}

export default function MapView({ lat, lng, radiusKm, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/dark-v11',
      center:    [lng, lat],
      zoom:      radiusToZoom(radiusKm),
    })

    // Marker with popup
    const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
      .setText(name)

    new mapboxgl.Marker({ color: '#58a6ff' })
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(map)

    map.on('load', () => {
      map.addSource('radius', {
        type: 'geojson',
        data: circleGeoJSON(lng, lat, radiusKm),
      })
      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius',
        paint: { 'fill-color': '#58a6ff', 'fill-opacity': 0.1 },
      })
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius',
        paint: { 'line-color': '#58a6ff', 'line-width': 1.5, 'line-opacity': 0.5 },
      })
    })

    return () => map.remove()
  }, [lat, lng, radiusKm, name])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: 380,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--color-border-subtle)',
      }}
    />
  )
}
