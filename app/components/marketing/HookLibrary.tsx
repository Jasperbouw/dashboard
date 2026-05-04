'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { HookModal } from './HookModal'
import type { Hook } from './HookModal'

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })

const NICHE_ORDER = ['bouw', 'dakkapel', 'daken', 'extras'] as const
const NICHE_LABEL: Record<string, string> = {
  bouw: 'Bouw', daken: 'Daken', dakkapel: 'Dakkapel', extras: 'Extras',
}
const NICHE_COLOR: Record<string, { color: string; bg: string }> = {
  bouw:     { color: 'var(--color-info)',    bg: 'var(--color-info-subtle)'    },
  daken:    { color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
  dakkapel: { color: 'var(--color-quote)',   bg: 'var(--color-quote-subtle)'   },
  extras:   { color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)' },
}
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  testing: { label: 'Testing', color: 'var(--color-info)',    bg: 'var(--color-info-subtle)'    },
  winner:  { label: 'Winner',  color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
  dead:    { label: 'Dead',    color: 'var(--color-ink-faint)', bg: 'var(--color-surface-raised)' },
}

interface Props {
  initialHooks: Hook[]
}

export function HookLibrary({ initialHooks }: Props) {
  const router = useRouter()
  const { data: hooks, mutate } = useSWR<Hook[]>('/api/hooks', fetcher, {
    fallbackData:       initialHooks,
    revalidateOnFocus:  false,
    dedupingInterval:   10_000,
  })

  const [modalOpen,    setModalOpen]    = useState(false)
  const [editHook,     setEditHook]     = useState<Hook | null>(null)
  const [defaultNiche, setDefaultNiche] = useState<string | undefined>()
  const [menuHookId,   setMenuHookId]   = useState<string | null>(null)

  const allHooks = hooks ?? []

  function openCreate(niche?: string) {
    setEditHook(null)
    setDefaultNiche(niche)
    setModalOpen(true)
  }

  function openEdit(hook: Hook) {
    setEditHook(hook)
    setDefaultNiche(undefined)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditHook(null)
  }

  function onSaved(saved: Hook) {
    mutate(prev => {
      const list = prev ?? []
      const idx  = list.findIndex(h => h.id === saved.id)
      if (idx >= 0) { const n = [...list]; n[idx] = saved; return n }
      return [saved, ...list]
    }, false)
    closeModal()
    router.refresh()
  }

  async function deleteHook(hook: Hook) {
    if (!confirm(`Hook "${hook.name}" verwijderen?`)) return
    mutate(prev => (prev ?? []).filter(h => h.id !== hook.id), false)
    await fetch(`/api/hooks/${hook.id}`, { method: 'DELETE' })
    router.refresh()
    setMenuHookId(null)
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
            Hook library
          </span>
          <button
            onClick={() => openCreate()}
            style={{
              padding: '6px 14px', background: 'var(--color-accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: 'var(--font-size-xs)', fontWeight: 500,
            }}
          >
            + Nieuwe hook
          </button>
        </div>

        {/* Per-niche sections */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {NICHE_ORDER.map((niche, idx) => {
            const nicheHooks = allHooks.filter(h => h.niche === niche)
            const nc = NICHE_COLOR[niche] ?? { color: 'var(--color-ink-muted)', bg: 'var(--color-surface-raised)' }

            return (
              <div key={niche} style={{
                borderTop: idx === 0 ? 'none' : '1px solid var(--color-border-subtle)',
              }}>
                {/* Niche header */}
                <div style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '10px 20px',
                  background:     'var(--color-surface-raised)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 'var(--font-size-xs)', fontWeight: 600,
                      color: nc.color, background: nc.bg,
                      padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    }}>
                      {NICHE_LABEL[niche]}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                      {nicheHooks.length} hook{nicheHooks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => openCreate(niche)}
                    style={{
                      background: 'none', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', padding: '3px 10px',
                      cursor: 'pointer', fontSize: 'var(--font-size-2xs)',
                      color: 'var(--color-ink-muted)',
                    }}
                  >
                    + Hook
                  </button>
                </div>

                {/* Hook cards */}
                {nicheHooks.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-xs)' }}>
                    Nog geen hooks voor {NICHE_LABEL[niche]}
                  </div>
                ) : (
                  <div style={{
                    display:             'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap:                 12,
                    padding:             16,
                  }}>
                    {nicheHooks.map(hook => {
                      const sm = STATUS_META[hook.status] ?? STATUS_META.testing
                      const menuOpen = menuHookId === hook.id

                      return (
                        <div
                          key={hook.id}
                          onClick={() => { if (!menuOpen) openEdit(hook) }}
                          style={{
                            background:   'var(--color-surface-raised)',
                            border:       '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding:      14,
                            cursor:       'pointer',
                            position:     'relative',
                            display:      'flex',
                            flexDirection: 'column',
                            gap:          8,
                            transition:   'border-color 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-strong)'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'}
                        >
                          {/* Card header: name + menu */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.3 }}>
                              {hook.name}
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); setMenuHookId(menuOpen ? null : hook.id) }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--color-ink-faint)', fontSize: 16, padding: '0 2px',
                                lineHeight: 1, flexShrink: 0,
                              }}
                            >
                              ⋯
                            </button>
                          </div>

                          {/* Status badge */}
                          <span style={{
                            alignSelf:    'flex-start',
                            fontSize:     'var(--font-size-2xs)', fontWeight: 600,
                            color:        sm.color, background: sm.bg,
                            padding:      '2px 7px', borderRadius: 'var(--radius-sm)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            {sm.label}
                          </span>

                          {/* Description — 2-line clamp */}
                          <p style={{
                            fontSize:   'var(--font-size-xs)',
                            color:      'var(--color-ink-muted)',
                            margin:     0,
                            lineHeight: 1.5,
                            display:    '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow:   'hidden',
                          }}>
                            {hook.description}
                          </p>

                          {/* Footer: times used */}
                          <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 'auto' }}>
                            {hook.times_used === 0 ? 'Nog niet gebruikt' : `${hook.times_used}× gebruikt`}
                          </div>

                          {/* Three-dot dropdown */}
                          {menuOpen && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{
                                position: 'absolute', top: 36, right: 8, zIndex: 50,
                                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                minWidth: 130, overflow: 'hidden',
                              }}
                            >
                              {[
                                { label: 'Bewerken',    action: () => { setMenuHookId(null); openEdit(hook) }, danger: false },
                                { label: 'Verwijderen', action: () => deleteHook(hook),                        danger: true  },
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

      {modalOpen && (
        <HookModal
          hook={editHook ?? undefined}
          defaultNiche={defaultNiche}
          onSaved={onSaved}
          onClose={closeModal}
        />
      )}
    </>
  )
}
