'use client'

import { useState } from 'react'
import type { NicheRow } from '../../../lib/metrics'

const NICHE_ORDER = ['bouw', 'dakkapel', 'daken', 'extras']
const NICHE_LABEL: Record<string, string> = {
  bouw: 'Bouw', dakkapel: 'Dakkapel', daken: 'Daken', extras: 'Extras',
}

interface Props {
  niches: NicheRow[]
}

export function NicheBreakdown({ niches }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const sorted = NICHE_ORDER
    .map(n => niches.find(r => r.niche === n))
    .filter((r): r is NicheRow => r != null)

  const totalLeads = sorted.reduce((s, r) => s + r.leads, 0)

  if (sorted.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '24px',
        color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)',
      }}>
        Geen data voor geselecteerde periode
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map(row => {
        const leadsPct = totalLeads > 0 ? (row.leads / totalLeads) * 100 : 0
        const qualPct  = row.leads > 0 ? Math.round((row.routed / row.leads) * 100) : null
        const isOpen   = expanded === row.niche

        return (
          <div key={row.niche} style={{
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow:     'hidden',
          }}>
            {/* Header row */}
            <div
              onClick={() => setExpanded(isOpen ? null : row.niche)}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        12,
                padding:    '10px 14px',
                cursor:     'pointer',
              }}
            >
              {/* Label */}
              <span style={{
                fontSize:   'var(--font-size-sm)',
                fontWeight: 500,
                color:      'var(--color-ink)',
                width:      80,
                flexShrink: 0,
              }}>
                {NICHE_LABEL[row.niche] ?? row.niche}
              </span>

              {/* Bar */}
              <div style={{
                flex: 1, height: 14,
                background:   'var(--color-surface-raised)',
                borderRadius: 'var(--radius-sm)',
                overflow:     'hidden',
              }}>
                <div style={{
                  width:      `${Math.max(leadsPct, row.leads > 0 ? 2 : 0)}%`,
                  height:     '100%',
                  background: 'var(--color-ink-faint)',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'width 0.3s ease',
                }} />
              </div>

              {/* Stats */}
              <div style={{
                display: 'flex', gap: 16,
                fontSize: 'var(--font-size-xs)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}>
                <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>
                  {row.leads} leads
                </span>
                <span style={{ color: 'var(--color-ink-muted)' }}>
                  {qualPct != null ? `${qualPct}% QL` : '—'}
                </span>
                <span style={{ color: 'var(--color-ink-faint)' }}>
                  {row.inspecties} insp
                </span>
                <span style={{ color: 'var(--color-ink-faint)' }}>
                  {row.offertes} offertes
                </span>
                <span style={{ color: 'var(--color-ink-faint)' }}>
                  {row.gewonnen} won
                </span>
              </div>

              <span style={{
                fontSize:   'var(--font-size-xs)',
                color:      'var(--color-ink-faint)',
                flexShrink: 0,
                display:    'inline-block',
                transform:  isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}>▾</span>
            </div>

            {/* Expanded: per-stage breakdown */}
            {isOpen && (
              <div style={{
                borderTop: '1px solid var(--color-border-subtle)',
                padding:   '10px 14px 12px',
                display:   'flex',
                gap:       24,
              }}>
                {[
                  { label: 'Leads',      value: row.leads },
                  { label: 'Gerouteerd', value: row.routed, pct: row.leads > 0 ? Math.round((row.routed / row.leads) * 100) : null },
                  { label: 'Inspecties', value: row.inspecties, pct: row.routed > 0 ? Math.round((row.inspecties / row.routed) * 100) : null },
                  { label: 'Offertes',   value: row.offertes,   pct: row.inspecties > 0 ? Math.round((row.offertes / row.inspecties) * 100) : null },
                  { label: 'Gewonnen',   value: row.gewonnen,   pct: row.offertes > 0 ? Math.round((row.gewonnen / row.offertes) * 100) : null },
                ].map(stat => (
                  <div key={stat.label}>
                    <div style={{
                      fontSize:      'var(--font-size-2xs)',
                      color:         'var(--color-ink-faint)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {stat.label}
                    </div>
                    <div style={{
                      fontSize:           'var(--font-size-md)',
                      fontWeight:         600,
                      color:              stat.value > 0 ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                      fontVariantNumeric: 'tabular-nums',
                      marginTop:          2,
                    }}>
                      {stat.value}
                    </div>
                    {stat.pct != null && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 1 }}>
                        {stat.pct}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
