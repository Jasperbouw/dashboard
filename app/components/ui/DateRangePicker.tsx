'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

interface DateRange { from: string; to: string }

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

function getPreset(key: string): DateRange {
  const now   = new Date()
  const today = isoDate(now)
  switch (key) {
    case 'this_month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: isoDate(from), to: isoDate(to) }
    }
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to   = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: isoDate(from), to: isoDate(to) }
    }
    case 'last_30d': {
      const from = new Date(now.getTime() - 30 * 86_400_000)
      return { from: isoDate(from), to: today }
    }
    case 'last_90d': {
      const from = new Date(now.getTime() - 90 * 86_400_000)
      return { from: isoDate(from), to: today }
    }
    case 'ytd': {
      return { from: `${now.getFullYear()}-01-01`, to: today }
    }
    default: return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  }
}

const PRESETS = [
  { label: 'Deze maand',  key: 'this_month' },
  { label: 'Vorige maand', key: 'last_month' },
  { label: 'Laatste 30d', key: 'last_30d' },
  { label: 'Laatste 90d', key: 'last_90d' },
  { label: 'YTD',         key: 'ytd' },
]

interface Props {
  from: string
  to:   string
}

export function DateRangePicker({ from, to }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [custom, setCustom] = useState(false)
  const [cFrom, setCFrom]   = useState(from)
  const [cTo, setCTo]       = useState(to)

  function apply(f: string, t: string) {
    router.push(`${pathname}?from=${f}&to=${t}`)
    setCustom(false)
  }

  // Detect active preset
  const activePreset = PRESETS.find(p => {
    const r = getPreset(p.key)
    return r.from === from && r.to === to
  })?.key ?? null

  const label = activePreset
    ? PRESETS.find(p => p.key === activePreset)!.label
    : `${from} → ${to}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', position: 'relative' }}>
      {PRESETS.map(p => (
        <button
          key={p.key}
          onClick={() => apply(...Object.values(getPreset(p.key)) as [string, string])}
          style={{
            fontSize:     'var(--font-size-xs)',
            padding:      '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border:       '1px solid',
            borderColor:  activePreset === p.key ? 'var(--color-info)' : 'var(--color-border)',
            background:   activePreset === p.key ? 'var(--color-info-subtle)' : 'transparent',
            color:        activePreset === p.key ? 'var(--color-info)' : 'var(--color-ink-muted)',
            cursor:       'pointer',
            whiteSpace:   'nowrap',
          }}
        >
          {p.label}
        </button>
      ))}

      <button
        onClick={() => setCustom(v => !v)}
        style={{
          fontSize:     'var(--font-size-xs)',
          padding:      '4px 10px',
          borderRadius: 'var(--radius-sm)',
          border:       '1px solid',
          borderColor:  custom ? 'var(--color-info)' : 'var(--color-border)',
          background:   custom ? 'var(--color-info-subtle)' : 'transparent',
          color:        custom ? 'var(--color-info)' : 'var(--color-ink-muted)',
          cursor:       'pointer',
        }}
      >
        Aangepast
      </button>

      {custom && (
        <div style={{
          position:     'absolute',
          top:          '100%',
          right:        0,
          marginTop:    6,
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding:      '12px 14px',
          display:      'flex',
          gap:          8,
          alignItems:   'center',
          zIndex:       50,
          boxShadow:    '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <input
            type="date" value={cFrom}
            onChange={e => setCFrom(e.target.value)}
            style={{
              background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--color-ink)', padding: '4px 8px',
              fontSize: 'var(--font-size-xs)',
            }}
          />
          <span style={{ color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-xs)' }}>→</span>
          <input
            type="date" value={cTo}
            onChange={e => setCTo(e.target.value)}
            style={{
              background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--color-ink)', padding: '4px 8px',
              fontSize: 'var(--font-size-xs)',
            }}
          />
          <button
            onClick={() => apply(cFrom, cTo)}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '4px 10px',
              background: 'var(--color-info)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            }}
          >
            Toepassen
          </button>
        </div>
      )}
    </div>
  )
}
