'use client'

import { useState } from 'react'

type Entry = { avg: number; count: number } | null

interface Props {
  bouw:  Entry
  daken: Entry
  gt:    Entry
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const OPTIONS = [
  { key: 'bouw',  label: 'Bouw' },
  { key: 'daken', label: 'Daken' },
  { key: 'gt',    label: 'GreenTeam' },
] as const

type Key = typeof OPTIONS[number]['key']

export function AvgDealValueCard({ bouw, daken, gt }: Props) {
  const [selected, setSelected] = useState<Key>('bouw')

  const data: Record<Key, Entry> = { bouw, daken, gt }
  const entry = data[selected]

  const sel: React.CSSProperties = {
    padding: '3px 8px',
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-ink)',
    fontSize: 'var(--font-size-xs)',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div style={{
      padding: '18px 20px', background: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Gem. deal value YTD
        </div>
        <select value={selected} onChange={e => setSelected(e.target.value as Key)} style={sel}>
          {OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
        {entry ? fmtEur(entry.avg) : '—'}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
        {entry ? `${entry.count} deal${entry.count !== 1 ? 's' : ''} · gem. per deal` : 'Geen data dit jaar'}
      </div>
    </div>
  )
}
