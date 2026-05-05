'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { UploadWinnerModal } from './UploadWinnerModal'
import { EditWinnerModal } from './EditWinnerModal'
import type { Winner } from './types'
import { NICHE_ORDER, NICHE_LABEL, NICHE_COLOR } from './types'

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })

interface Props {
  initialWinners: Winner[]
}

function fmtEur(v: number | null) {
  if (v === null) return '—'
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function WinnersLibrary({ initialWinners }: Props) {
  const router = useRouter()
  const { data: winners, mutate } = useSWR<Winner[]>('/api/winners', fetcher, {
    fallbackData:      initialWinners,
    revalidateOnFocus: false,
    dedupingInterval:  10_000,
  })

  const [uploadOpen,   setUploadOpen]   = useState(false)
  const [editWinner,   setEditWinner]   = useState<Winner | null>(null)
  const [defaultNiche, setDefaultNiche] = useState<string | undefined>()
  const [menuId,       setMenuId]       = useState<string | null>(null)

  const allWinners = winners ?? []

  function openUpload(niche?: string) {
    setDefaultNiche(niche)
    setUploadOpen(true)
  }

  function onSaved(saved: Winner) {
    mutate(prev => {
      const list = prev ?? []
      const idx  = list.findIndex(w => w.id === saved.id)
      if (idx >= 0) { const n = [...list]; n[idx] = saved; return n }
      return [saved, ...list]
    }, false)
    setUploadOpen(false)
    setEditWinner(null)
    router.refresh()
  }

  async function deleteWinner(w: Winner) {
    if (!confirm(`Winner verwijderen? Dit verwijdert ook het bestand.`)) return
    mutate(prev => (prev ?? []).filter(x => x.id !== w.id), false)
    await fetch(`/api/winners/${w.id}`, { method: 'DELETE' })
    router.refresh()
    setMenuId(null)
  }

  return (
    <>
      <div style={{
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow:     'hidden',
      }}>
        {/* Section header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '14px 20px',
          borderBottom:   '1px solid var(--color-border-subtle)',
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            Winners
          </span>
          <button
            onClick={() => openUpload()}
            style={{ padding: '6px 14px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500 }}
          >
            + Winner toevoegen
          </button>
        </div>

        {/* Per-niche sections */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {NICHE_ORDER.map((niche, idx) => {
            const nicheWinners = allWinners.filter(w => w.niche === niche)
            const nc = NICHE_COLOR[niche] ?? { color: 'var(--color-ink-muted)', bg: 'var(--color-surface-raised)' }

            return (
              <div key={niche} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--color-border-subtle)' }}>
                {/* Niche header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'var(--color-surface-raised)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: nc.color, background: nc.bg, padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                      {NICHE_LABEL[niche]}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                      {nicheWinners.filter(w => w.is_winner).length} winner{nicheWinners.filter(w => w.is_winner).length !== 1 ? 's' : ''} · {nicheWinners.length} totaal
                    </span>
                  </div>
                  <button
                    onClick={() => openUpload(niche)}
                    style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', cursor: 'pointer', fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-muted)' }}
                  >
                    + Upload
                  </button>
                </div>

                {/* Cards */}
                {nicheWinners.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-xs)' }}>
                    Nog geen winners voor {NICHE_LABEL[niche]}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, padding: 16 }}>
                    {nicheWinners.map(w => {
                      const menuOpen = menuId === w.id
                      return (
                        <div
                          key={w.id}
                          onClick={() => { if (!menuOpen) setEditWinner(w) }}
                          style={{
                            background:    'var(--color-surface-raised)',
                            border:        `1px solid ${w.is_winner ? 'var(--color-success)' : 'var(--color-border)'}`,
                            borderRadius:  'var(--radius-md)',
                            overflow:      'hidden',
                            cursor:        'pointer',
                            position:      'relative',
                            display:       'flex',
                            flexDirection: 'column',
                            transition:    'border-color 0.1s',
                          }}
                          onMouseEnter={e => { if (!w.is_winner) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-strong)' }}
                          onMouseLeave={e => { if (!w.is_winner) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)' }}
                        >
                          {/* Image */}
                          <div style={{ position: 'relative', paddingTop: '56.25%', background: 'var(--color-surface)' }}>
                            <img
                              src={w.thumbnail_url ?? w.image_url}
                              alt={w.overlay_text ?? 'winner'}
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {w.is_winner && (
                              <span style={{
                                position: 'absolute', top: 6, left: 6,
                                fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                                color: 'var(--color-success)', background: 'var(--color-success-subtle)',
                                padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                              }}>
                                ✓ Winner
                              </span>
                            )}
                            {/* Three-dot menu */}
                            <button
                              onClick={e => { e.stopPropagation(); setMenuId(menuOpen ? null : w.id) }}
                              style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, padding: '2px 6px', borderRadius: 'var(--radius-sm)', lineHeight: 1 }}
                            >
                              ⋯
                            </button>
                          </div>

                          {/* Body */}
                          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            {w.overlay_text && (
                              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {w.overlay_text}
                              </div>
                            )}
                            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 'auto', lineHeight: 1.6 }}>
                              {[
                                w.spend       !== null ? `${fmtEur(w.spend)} spend`        : null,
                                w.leads       !== null ? `${w.leads} leads`                 : null,
                                w.cpl         !== null ? `${fmtEur(w.cpl)} CPL`             : null,
                                w.ctr         !== null ? `${w.ctr}% CTR`                    : null,
                              ].filter(Boolean).join(' · ')}
                            </div>
                          </div>

                          {/* Dropdown */}
                          {menuOpen && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{ position: 'absolute', top: 32, right: 8, zIndex: 50, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', minWidth: 130, overflow: 'hidden' }}
                            >
                              {[
                                { label: 'Bewerken',    action: () => { setMenuId(null); setEditWinner(w) }, danger: false },
                                { label: 'Verwijderen', action: () => deleteWinner(w),                       danger: true  },
                              ].map(item => (
                                <button key={item.label} onClick={item.action}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: item.danger ? 'var(--color-critical)' : 'var(--color-ink)' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {uploadOpen && (
        <UploadWinnerModal
          defaultNiche={defaultNiche}
          onSaved={onSaved}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {editWinner && (
        <EditWinnerModal
          winner={editWinner}
          onSaved={onSaved}
          onClose={() => setEditWinner(null)}
        />
      )}
    </>
  )
}
