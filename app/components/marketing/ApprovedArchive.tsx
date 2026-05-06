'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { NICHE_COLOR, NICHE_LABEL } from './types'

interface ApprovedCreative {
  id:                string
  niche:             string
  batch_date:        string
  copy_headline:     string | null
  copy_body:         string | null
  copy_cta:          string | null
  angle_description: string | null
  image_url:         string
  reviewed_at:       string | null
}

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })

function sinceDate(range: '7d' | '30d' | 'all'): string {
  if (range === 'all') return ''
  const d = new Date()
  d.setDate(d.getDate() - (range === '7d' ? 7 : 30))
  return d.toISOString().slice(0, 10)  // date-only keeps SWR key stable across re-renders
}

function fmtApproved(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

export function ApprovedArchive() {
  const [niche,      setNiche]      = useState('')
  const [range,      setRange]      = useState<'7d' | '30d' | 'all'>('30d')
  const [reverting,  setReverting]  = useState<string | null>(null)
  const [openMenu,   setOpenMenu]   = useState<string | null>(null)

  const since = sinceDate(range)
  const key   = `/api/marketing/creatives?status=published${niche ? `&niche=${niche}` : ''}${since ? `&since=${encodeURIComponent(since)}` : ''}`

  const { data: creatives, error, mutate } = useSWR<ApprovedCreative[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval:  10_000,
  })

  async function revertToPending(id: string) {
    setReverting(id)
    setOpenMenu(null)
    await fetch(`/api/marketing/creatives/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'pending' }),
    })
    setReverting(null)
    mutate()
  }

  const items = creatives ?? []

  const selectStyle: React.CSSProperties = {
    background:   'var(--color-surface-raised)',
    border:       '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color:        'var(--color-ink-muted)',
    fontSize:     'var(--font-size-xs)',
    padding:      '5px 10px',
    outline:      'none',
    cursor:       'pointer',
  }

  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow:     'hidden',
      marginTop:    24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle)', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            Goedgekeurde creatives
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginLeft: 10 }}>
            Klaar voor gebruik in Meta — download en upload
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={niche} onChange={e => setNiche(e.target.value)} style={selectStyle}>
            <option value="">Alle niches</option>
            <option value="bouw">Bouw</option>
            <option value="dakkapel">Dakkapel</option>
            <option value="daken">Daken</option>
          </select>
          <select value={range} onChange={e => setRange(e.target.value as typeof range)} style={selectStyle}>
            <option value="7d">Laatste 7 dagen</option>
            <option value="30d">Laatste 30 dagen</option>
            <option value="all">Alle</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: 16 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: error ? 'var(--color-critical)' : 'var(--color-ink-muted)', marginBottom: 6 }}>
              {error
                ? `Fout bij laden: ${error.message}`
                : creatives === undefined
                  ? 'Laden…'
                  : 'Nog geen goedgekeurde creatives.'}
            </div>
            {!error && creatives !== undefined && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                Klik 👍 op een creative in de output feed om hem hier te bewaren.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {items.map(c => {
              const nc        = NICHE_COLOR[c.niche] ?? { color: 'var(--color-ink-muted)', bg: 'var(--color-surface-raised)' }
              const isRev     = reverting === c.id
              const menuOpen  = openMenu === c.id
              const filename  = `bouwcheck-${c.niche}-${c.batch_date}-${c.id.slice(0, 8)}.png`

              return (
                <div key={c.id} style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: isRev ? 0.5 : 1 }}>
                  {/* Image */}
                  <div style={{ position: 'relative', paddingTop: '100%', background: '#1a1a1a' }}>
                    <img
                      src={c.image_url}
                      alt={c.copy_headline ?? 'creative'}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    <span style={{
                      position: 'absolute', top: 6, left: 6,
                      fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                      color: nc.color, background: nc.bg,
                      padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {NICHE_LABEL[c.niche]}
                    </span>
                    {/* ⋯ menu button */}
                    <div style={{ position: 'absolute', top: 6, right: 6 }}>
                      <button
                        onClick={() => setOpenMenu(menuOpen ? null : c.id)}
                        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-ink-muted)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
                      >
                        ⋯
                      </button>
                      {menuOpen && (
                        <div style={{ position: 'absolute', top: 28, right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', minWidth: 180, zIndex: 10 }}>
                          <button
                            onClick={() => revertToPending(c.id)}
                            style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            Verwijder uit goedgekeurd
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Copy */}
                  <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {c.copy_headline && (
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.3 }}>
                        {c.copy_headline}
                      </div>
                    )}
                    {c.copy_body && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', lineHeight: 1.4 }}>
                        {c.copy_body}
                      </div>
                    )}
                    {c.copy_cta && (
                      <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-accent)', marginTop: 2 }}>
                        → {c.copy_cta}
                      </div>
                    )}
                    {c.reviewed_at && (
                      <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
                        Goedgekeurd op {fmtApproved(c.reviewed_at)}
                      </div>
                    )}
                  </div>

                  {/* Download */}
                  <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '0' }}>
                    <button
                      onClick={() => downloadImage(c.image_url, filename)}
                      style={{ width: '100%', padding: '9px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', fontWeight: 500 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      ⬇ Download
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
