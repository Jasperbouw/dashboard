'use client'

import { useState } from 'react'
import type { StageDistribution } from '../../../lib/metrics'

const STAGE_META: Record<string, { label: string; color: string }> = {
  new:        { label: 'Nieuw',      color: 'var(--color-idle)' },
  contacted:  { label: 'Gebeld',     color: 'var(--color-info)' },
  inspection: { label: 'Inspectie',  color: 'var(--color-success)' },
  quote_sent: { label: 'Offerte',    color: 'var(--color-quote)' },
  won:        { label: 'Gewonnen',   color: 'var(--color-won)' },
  deferred:   { label: 'Uitgesteld', color: 'var(--color-warning)' },
  lost:       { label: 'Verloren',   color: 'var(--color-critical)' },
}
const STAGE_ORDER = ['new', 'contacted', 'inspection', 'quote_sent', 'won', 'deferred', 'lost']

const NICHE_LABELS: Record<string, string> = {
  bouw: 'Bouw', dakkapel: 'Dakkapel', daken: 'Daken', extras: 'Extras',
}

interface Props { distribution: StageDistribution }

export function StageDistributionChart({ distribution }: Props) {
  const niches  = ['bouw', 'dakkapel', 'daken', 'extras'].filter(n => distribution.byNiche[n])
  const [activeNiche, setActiveNiche] = useState<string | null>(null)

  const counts = activeNiche
    ? (distribution.byNiche[activeNiche] ?? {})
    : distribution.counts

  const total = Object.values(counts).reduce((s, v) => s + v, 0)

  return (
    <div>
      {/* Niche filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveNiche(null)}
          style={{
            fontSize: 'var(--font-size-xs)', padding: '3px 10px',
            borderRadius: 'var(--radius-full)', border: '1px solid',
            borderColor: !activeNiche ? 'var(--color-info)' : 'var(--color-border)',
            background:  !activeNiche ? 'var(--color-info-subtle)' : 'transparent',
            color:       !activeNiche ? 'var(--color-info)' : 'var(--color-ink-muted)',
            cursor: 'pointer',
          }}
        >
          Alle niches
        </button>
        {niches.map(n => (
          <button
            key={n}
            onClick={() => setActiveNiche(activeNiche === n ? null : n)}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '3px 10px',
              borderRadius: 'var(--radius-full)', border: '1px solid',
              borderColor: activeNiche === n ? 'var(--color-info)' : 'var(--color-border)',
              background:  activeNiche === n ? 'var(--color-info-subtle)' : 'transparent',
              color:       activeNiche === n ? 'var(--color-info)' : 'var(--color-ink-muted)',
              cursor: 'pointer',
            }}
          >
            {NICHE_LABELS[n] ?? n}
          </button>
        ))}
      </div>

      {/* Stage rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STAGE_ORDER.map(stage => {
          const meta  = STAGE_META[stage]
          const count = counts[stage] ?? 0
          const pct   = total > 0 ? count / total : 0

          return (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Stage label */}
              <div style={{
                width:      80, flexShrink: 0,
                fontSize:   'var(--font-size-xs)',
                color:      'var(--color-ink-muted)',
                textAlign:  'right',
              }}>
                {meta?.label ?? stage}
              </div>

              {/* Bar */}
              <div style={{
                flex: 1, height: 18,
                background:   'var(--color-surface-raised)',
                borderRadius: 'var(--radius-sm)',
                overflow:     'hidden',
              }}>
                <div style={{
                  width:        `${Math.max(pct * 100, pct > 0 ? 1 : 0)}%`,
                  height:       '100%',
                  background:   meta?.color ?? 'var(--color-border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  transition:   'width 0.3s ease',
                }} />
              </div>

              {/* Count */}
              <div style={{
                width:              36, flexShrink: 0,
                fontSize:           'var(--font-size-xs)',
                color:              count > 0 ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                fontVariantNumeric: 'tabular-nums',
                textAlign:          'right',
              }}>
                {count}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 12, fontSize: 'var(--font-size-2xs)',
        color: 'var(--color-ink-faint)',
      }}>
        Momentopname — {total} leads{activeNiche ? ` in ${NICHE_LABELS[activeNiche]}` : ''} · gefilterd op actieve contractors
      </div>
    </div>
  )
}
