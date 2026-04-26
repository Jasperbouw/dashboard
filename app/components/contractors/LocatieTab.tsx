'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const MapView = dynamic(() => import('./MapView'), {
  ssr:     false,
  loading: () => (
    <div style={{
      height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)',
      fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-faint)',
    }}>
      Kaart laden…
    </div>
  ),
})

const NL_PROVINCES = [
  'Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen',
  'Limburg', 'Noord-Brabant', 'Noord-Holland', 'Overijssel',
  'Utrecht', 'Zeeland', 'Zuid-Holland',
]

const NL_COUNTRIES = [
  { value: 'NL', label: 'Nederland' },
  { value: 'BE', label: 'België'    },
  { value: 'DE', label: 'Duitsland' },
]

interface LocationData {
  street_address:    string | null
  postal_code:       string | null
  city:              string | null
  country:           string | null
  latitude:          number | null
  longitude:         number | null
  service_radius_km: number | null
  service_provinces: string[] | null
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--color-ink)', fontSize: 'var(--font-size-sm)', outline: 'none',
  boxSizing: 'border-box', width: '100%',
}
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', fontWeight: 600,
  color: 'var(--color-ink-faint)', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: 4, display: 'block',
}
const sectionTitle = (text: string) => (
  <div style={{
    fontSize: 'var(--font-size-xs)', fontWeight: 600,
    color: 'var(--color-ink-faint)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 14,
  }}>
    {text}
  </div>
)

interface Props {
  contractorId:   string
  contractorName: string
}

export function LocatieTab({ contractorId, contractorName }: Props) {
  const [loc, setLoc]   = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(true)

  // Address form
  const [addrForm, setAddrForm] = useState({
    street_address: '', postal_code: '', city: '', country: 'NL',
  })
  const [addrSaving, setAddrSaving] = useState(false)
  const [addrError,  setAddrError]  = useState('')
  const [addrSaved,  setAddrSaved]  = useState(false)

  // Werkgebied form
  const [radius, setRadius]       = useState('50')
  const [provinces, setProvinces] = useState<string[]>([])
  const [wkSaving, setWkSaving]   = useState(false)
  const [wkError,  setWkError]    = useState('')
  const [wkSaved,  setWkSaved]    = useState(false)

  async function loadLocation() {
    setLoading(true)
    const r = await fetch(`/api/contractors/${contractorId}/location`)
    if (r.ok) {
      const d: LocationData = await r.json()
      setLoc(d)
      setAddrForm({
        street_address: d.street_address ?? '',
        postal_code:    d.postal_code    ?? '',
        city:           d.city           ?? '',
        country:        d.country        ?? 'NL',
      })
      setRadius(String(d.service_radius_km ?? 50))
      setProvinces(d.service_provinces ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadLocation() }, [contractorId])

  async function saveAddress() {
    setAddrSaving(true); setAddrError(''); setAddrSaved(false)
    const r = await fetch(`/api/contractors/${contractorId}/location`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(addrForm),
    })
    setAddrSaving(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setAddrError(j.error ?? 'Opslaan mislukt'); return
    }
    const updated: LocationData = await r.json()
    setLoc(prev => prev ? { ...prev, ...updated } : updated)
    setAddrSaved(true)
    setTimeout(() => setAddrSaved(false), 2500)
  }

  async function saveWerkgebied() {
    setWkSaving(true); setWkError(''); setWkSaved(false)
    const r = await fetch(`/api/contractors/${contractorId}/location`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ service_radius_km: Number(radius), service_provinces: provinces }),
    })
    setWkSaving(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setWkError(j.error ?? 'Opslaan mislukt'); return
    }
    const updated: LocationData = await r.json()
    setLoc(prev => prev ? { ...prev, ...updated } : updated)
    setWkSaved(true)
    setTimeout(() => setWkSaved(false), 2500)
  }

  function toggleProvince(p: string) {
    setProvinces(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const hasCoords = loc?.latitude != null && loc?.longitude != null

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
      Laden…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Section 1: Adres ───────────────────────────────────────────── */}
      <div>
        {sectionTitle('Adres')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Straat + huisnummer</label>
            <input
              type="text"
              value={addrForm.street_address}
              onChange={e => setAddrForm(f => ({ ...f, street_address: e.target.value }))}
              placeholder="Noorddammerweg 35"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Postcode</label>
              <input
                type="text"
                value={addrForm.postal_code}
                onChange={e => setAddrForm(f => ({ ...f, postal_code: e.target.value }))}
                placeholder="1424 NW"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Plaats</label>
              <input
                type="text"
                value={addrForm.city}
                onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))}
                placeholder="De Kwakel"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Land</label>
            <select
              value={addrForm.country}
              onChange={e => setAddrForm(f => ({ ...f, country: e.target.value }))}
              style={inputStyle}
            >
              {NL_COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {addrError && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{addrError}</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={saveAddress}
              disabled={addrSaving}
              style={{
                padding: '7px 18px', background: 'var(--color-accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                cursor: addrSaving ? 'default' : 'pointer',
                fontSize: 'var(--font-size-sm)', fontWeight: 500,
                opacity: addrSaving ? 0.7 : 1,
              }}
            >
              {addrSaving ? 'Opslaan…' : 'Opslaan'}
            </button>
            {addrSaved && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                {hasCoords || (loc?.latitude != null) ? 'Opgeslagen + gecodeerd ✓' : 'Opgeslagen ✓'}
              </span>
            )}
          </div>

          {loc?.latitude == null && loc && (addrForm.street_address || addrForm.city) && !addrSaved && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', fontStyle: 'italic' }}>
              Sla op om coördinaten op te halen en kaart te tonen.
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Werkgebied ──────────────────────────────────────── */}
      <div>
        {sectionTitle('Werkgebied')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Straal (km)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min="0"
                max="500"
                step="5"
                value={radius}
                onChange={e => setRadius(e.target.value)}
                style={{ ...inputStyle, width: 100 }}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                km rondom vestigingsadres
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Provincies</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {NL_PROVINCES.map(p => {
                const active = provinces.includes(p)
                return (
                  <button
                    key={p}
                    onClick={() => toggleProvince(p)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 'var(--font-size-xs)',
                      borderRadius: 'var(--radius-full)',
                      border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                      background: active ? 'rgba(88,166,255,0.15)' : 'var(--color-surface-raised)',
                      color: active ? 'var(--color-accent)' : 'var(--color-ink-muted)',
                      cursor: 'pointer',
                      fontWeight: active ? 600 : 400,
                      transition: 'all 0.1s',
                    }}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
            {provinces.length > 0 && (
              <button
                onClick={() => setProvinces([])}
                style={{
                  alignSelf: 'flex-start', fontSize: 'var(--font-size-2xs)',
                  color: 'var(--color-ink-faint)', background: 'none', border: 'none',
                  cursor: 'pointer', textDecoration: 'underline', padding: 0,
                }}
              >
                Alles deselecteren
              </button>
            )}
            {provinces.length === 0 && (
              <button
                onClick={() => setProvinces([...NL_PROVINCES])}
                style={{
                  alignSelf: 'flex-start', fontSize: 'var(--font-size-2xs)',
                  color: 'var(--color-ink-faint)', background: 'none', border: 'none',
                  cursor: 'pointer', textDecoration: 'underline', padding: 0,
                }}
              >
                Heel Nederland selecteren
              </button>
            )}
          </div>

          {wkError && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{wkError}</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={saveWerkgebied}
              disabled={wkSaving}
              style={{
                padding: '7px 18px', background: 'var(--color-accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                cursor: wkSaving ? 'default' : 'pointer',
                fontSize: 'var(--font-size-sm)', fontWeight: 500,
                opacity: wkSaving ? 0.7 : 1,
              }}
            >
              {wkSaving ? 'Opslaan…' : 'Opslaan'}
            </button>
            {wkSaved && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>Opgeslagen ✓</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Kaart ──────────────────────────────────────────── */}
      <div>
        {sectionTitle('Kaart')}
        {hasCoords ? (
          <>
            <MapView
              lat={loc!.latitude!}
              lng={loc!.longitude!}
              radiusKm={loc!.service_radius_km ?? 50}
              name={contractorName}
            />
            {loc!.service_provinces && loc!.service_provinces.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {loc!.service_provinces.map(p => (
                  <span key={p} style={{
                    padding: '2px 8px', fontSize: 'var(--font-size-2xs)', fontWeight: 500,
                    background: 'rgba(88,166,255,0.1)', color: 'var(--color-accent)',
                    border: '1px solid rgba(88,166,255,0.3)',
                    borderRadius: 'var(--radius-full)',
                  }}>
                    {p}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 160, gap: 8,
            background: 'var(--color-surface-raised)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-faint)' }}>
              Locatie nog niet ingevuld
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
              Vul adres in om kaart te tonen
            </span>
          </div>
        )}
      </div>

    </div>
  )
}
