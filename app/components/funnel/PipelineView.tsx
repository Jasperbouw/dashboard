'use client'

import { useState } from 'react'
import type { StageDistribution } from '../../../lib/metrics'

const STAGES = [
  { key: 'new',        label: 'Nieuwe leads',     color: '#58a6ff' },
  { key: 'contacted',  label: 'Doorgezet',         color: '#a371f7' },
  { key: 'quote_sent', label: 'Offerte',           color: '#f0883e' },
  { key: 'won',        label: 'Gewonnen',          color: '#3fb950' },
  { key: 'lost',       label: 'Niet interessant',  color: '#6e7681' },
]

const NICHE_LABELS: Record<string, string> = {
  bouw: 'Bouw', dakkapel: 'Dakkapel', daken: 'Daken', extras: 'Extras',
}

interface Props {
  distribution:  StageDistribution
  wonFromDeals?: number
}

export function PipelineView({ distribution, wonFromDeals = 0 }: Props) {
  const niches       = ['bouw', 'dakkapel', 'daken', 'extras'].filter(n => distribution.byNiche[n])
  const [activeNiche, setActiveNiche] = useState<string | null>(null)

  const counts = activeNiche
    ? (distribution.byNiche[activeNiche] ?? {})
    : distribution.counts

  const maxCount = Math.max(...STAGES.map(s => counts[s.key] ?? 0), 1)
  const total    = (counts['new'] ?? 0)

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 'var(--font-size-xs)', padding: '3px 12px',
    borderRadius: 'var(--radius-full)', border: '1px solid', cursor: 'pointer',
    borderColor: active ? 'var(--color-info)' : 'var(--color-border)',
    background:  active ? 'var(--color-info-subtle)' : 'transparent',
    color:       active ? 'var(--color-info)' : 'var(--color-ink-muted)',
  })

  return (
    <div>
      {/* Niche pills */}
      {niches.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          <button style={pill(!activeNiche)} onClick={() => setActiveNiche(null)}>Alle niches</button>
          {niches.map(n => (
            <button key={n} style={pill(activeNiche === n)} onClick={() => setActiveNiche(activeNiche === n ? null : n)}>
              {NICHE_LABELS[n] ?? n}
            </button>
          ))}
        </div>
      )}

      {/* Stage bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {STAGES.map(stage => {
          const rawCount = counts[stage.key] ?? 0
        const count    = stage.key === 'won' ? Math.max(rawCount, wonFromDeals) : rawCount
          const barPct  = (count / maxCount) * 100
          const ofTotal = total > 0 ? Math.round((count / total) * 100) : 0

          return (
            <div key={stage.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Label */}
                <div style={{ width: 130, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', textAlign: 'right' }}>
                  {stage.label}
                </div>

                {/* Bar */}
                <div style={{ flex: 1, height: 28, background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max(barPct, count > 0 ? 1.5 : 0)}%`,
                    height: '100%',
                    background: stage.color,
                    borderRadius: 'var(--radius-sm)',
                    transition: 'width 0.35s ease',
                    display: 'flex', alignItems: 'center', paddingLeft: 10,
                  }}>
                    {barPct > 12 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                        {count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Count (when bar too small) */}
                <div style={{ width: 36, flexShrink: 0, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: count > 0 ? 'var(--color-ink)' : 'var(--color-ink-faint)', fontVariantNumeric: 'tabular-nums' }}>
                  {barPct <= 12 ? count : ''}
                </div>

                {/* % of total (relative to new) */}
                <div style={{ width: 40, flexShrink: 0, textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', fontVariantNumeric: 'tabular-nums' }}>
                  {stage.key !== 'new' && total > 0 ? `${ofTotal}%` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>
        Momentopname · actieve leads
      </div>
    </div>
  )
}
