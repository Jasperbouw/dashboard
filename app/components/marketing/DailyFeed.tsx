'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { NICHE_COLOR, NICHE_LABEL } from './types'

interface Creative {
  id:                string
  niche:             string
  batch_date:        string
  copy_headline:     string | null
  copy_body:         string | null
  copy_cta:          string | null
  angle_description: string | null
  image_url:         string
  status:            string
  reviewed_at:       string | null
  winners:           { overlay_text: string | null; notes: string | null } | null
}

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' })
}

export function DailyFeed() {
  const [date,      setDate]      = useState(todayStr())
  const [actioned,  setActioned]  = useState<Set<string>>(new Set())
  const [acting,    setActing]    = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState('')
  const [genResult,  setGenResult]  = useState('')

  const { data: creatives, mutate } = useSWR<Creative[]>(
    `/api/marketing/creatives?status=pending&date=${date}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5_000 },
  )

  const visible = (creatives ?? []).filter(c => !actioned.has(c.id))

  async function action(id: string, status: 'published' | 'rejected') {
    setActing(id)
    await fetch(`/api/marketing/creatives/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    setActing(null)
    setActioned(prev => new Set([...prev, id]))
    mutate()
  }

  async function triggerGenerate() {
    setGenerating(true); setGenError(''); setGenResult('')
    // Cookie is sent automatically (same-origin). No secret header needed from browser.
    const r = await fetch('/api/marketing/generate-batch', { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    setGenerating(false)
    if (!r.ok || !j.ok) {
      setGenError((j as { error?: string }).error ?? 'Genereren mislukt')
    } else {
      setGenResult(`Batch klaar: ${j.creatives} creatives gegenereerd${j.errors?.length ? ` (${j.errors.length} fouten)` : ''}`)
      setDate(todayStr())
      mutate()
    }
  }

  // Next 07:00 CET for empty state
  const tomorrowAt7 = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return `${d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })} 07:00`
  })()

  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow:     'hidden',
      marginTop:    24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            Daily output feed
          </span>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={e => { setDate(e.target.value); setActioned(new Set()) }}
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}
          />
          {date !== todayStr() && (
            <button onClick={() => { setDate(todayStr()); setActioned(new Set()) }} style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-info)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Vandaag
            </button>
          )}
        </div>
        <button
          onClick={triggerGenerate}
          disabled={generating}
          title={generating ? 'Dit duurt 30–60 seconden…' : undefined}
          style={{ padding: '5px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: generating ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', color: generating ? 'var(--color-ink-faint)' : 'var(--color-ink-muted)', opacity: generating ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {generating && (
            <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-ink-muted)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          )}
          {generating ? 'Bezig met genereren…' : '⚡ Genereer nu'}
        </button>
      </div>

      {/* Gen feedback */}
      {genResult && (
        <div style={{ padding: '8px 20px', background: 'var(--color-success-subtle)', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>
          {genResult}
        </div>
      )}
      {genError && (
        <div style={{ padding: '8px 20px', background: 'var(--color-critical-subtle, var(--color-surface-raised))', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>
          {genError}
        </div>
      )}

      {/* Feed */}
      <div style={{ padding: 16 }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginBottom: 6 }}>
              {(creatives ?? []).length === 0
                ? `Geen creatives klaar voor review${date === todayStr() ? '' : ` op ${fmtDate(date)}`}.`
                : 'Alle creatives zijn beoordeeld.'}
            </div>
            {date === todayStr() && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                Volgende automatische batch: {tomorrowAt7}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {visible.map(c => {
              const nc = NICHE_COLOR[c.niche] ?? { color: 'var(--color-ink-muted)', bg: 'var(--color-surface-raised)' }
              const isActing = acting === c.id

              return (
                <div key={c.id} style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                  </div>

                  {/* Copy */}
                  <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {c.copy_headline && (
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.3 }}>
                        {c.copy_headline}
                      </div>
                    )}
                    {c.copy_body && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
                        {c.copy_body}
                      </div>
                    )}
                    {c.copy_cta && (
                      <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-accent)', marginTop: 2 }}>
                        → {c.copy_cta}
                      </div>
                    )}
                    {c.angle_description && (
                      <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', fontStyle: 'italic', marginTop: 4, lineHeight: 1.4 }}>
                        {c.angle_description}
                      </div>
                    )}
                    {c.winners?.overlay_text && (
                      <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 6 }}>
                        Gebaseerd op: <em>{c.winners.overlay_text}</em>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', borderTop: '1px solid var(--color-border-subtle)' }}>
                    <button
                      onClick={() => action(c.id, 'published')}
                      disabled={isActing}
                      style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', borderRight: '1px solid var(--color-border-subtle)', cursor: isActing ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 500 }}
                      onMouseEnter={e => { if (!isActing) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-success-subtle)' }}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
                    >
                      👍 Publiceren
                    </button>
                    <button
                      onClick={() => action(c.id, 'rejected')}
                      disabled={isActing}
                      style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', cursor: isActing ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}
                      onMouseEnter={e => { if (!isActing) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-raised)' }}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
                    >
                      👎 Skip
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
