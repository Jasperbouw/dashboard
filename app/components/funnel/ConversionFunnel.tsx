import type { FunnelTransitionsResult } from '../../../lib/metrics'

const STAGE_META = [
  { key: 'new',        label: 'Leads ontvangen',  rateKey: null },
  { key: 'contacted',  label: 'Opgepakt',           rateKey: 'new_to_contacted' },
  { key: 'inspection', label: 'Inspectie',         rateKey: 'contacted_to_inspection' },
  { key: 'quote_sent', label: 'Offerte',           rateKey: 'inspection_to_quote_sent' },
  { key: 'won',        label: 'Gewonnen',          rateKey: 'quote_sent_to_won' },
]

const STAGE_COLOR: Record<string, string> = {
  new:        'var(--color-idle)',
  contacted:  'var(--color-info)',
  inspection: 'var(--color-success)',
  quote_sent: 'var(--color-quote)',
  won:        'var(--color-won)',
}

interface Props {
  result: FunnelTransitionsResult
}

export function ConversionFunnel({ result }: Props) {
  if (!result.reliable) {
    return (
      <div style={{
        padding:      '12px 16px',
        color:        'var(--color-ink-faint)',
        fontSize:     'var(--font-size-xs)',
        background:   'var(--color-surface-raised)',
        borderRadius: 'var(--radius-md)',
        border:       '1px solid var(--color-border-subtle)',
        display:      'flex',
        alignItems:   'center',
        gap:          8,
      }}>
        <span>📈</span>
        <span>
          Conversiefunnel beschikbaar na 14 dagen status-historie —
          huidig <strong>{Math.round(result.daysOfData ?? 0)} dagen</strong> beschikbaar.
        </span>
      </div>
    )
  }

  const { stageCounts, conversionRates } = result
  const maxCount = Math.max(...STAGE_META.map(s => stageCounts[s.key] ?? 0), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {STAGE_META.map((stage, i) => {
        const count = stageCounts[stage.key] ?? 0
        const rate  = stage.rateKey ? conversionRates[stage.rateKey] : null
        const widthPct = (count / maxCount) * 100

        return (
          <div key={stage.key}>
            {/* Conversion arrow between stages */}
            {i > 0 && (
              <div style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                padding:    '4px 0 4px 96px',
              }}>
                <span style={{ color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-xs)' }}>↓</span>
                <span style={{
                  fontSize:  'var(--font-size-xs)',
                  color:     rate != null ? 'var(--color-ink-muted)' : 'var(--color-ink-faint)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {rate != null ? `${rate}% conversie` : '—'}
                </span>
              </div>
            )}

            {/* Stage row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width:    88, flexShrink: 0,
                fontSize: 'var(--font-size-xs)',
                color:    'var(--color-ink-muted)',
                textAlign: 'right',
              }}>
                {stage.label}
              </div>

              {/* Bar */}
              <div style={{
                flex:         1,
                height:       28,
                background:   'var(--color-surface-raised)',
                borderRadius: 'var(--radius-sm)',
                overflow:     'hidden',
              }}>
                <div style={{
                  width:        `${Math.max(widthPct, count > 0 ? 2 : 0)}%`,
                  height:       '100%',
                  background:   STAGE_COLOR[stage.key] ?? 'var(--color-border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  transition:   'width 0.4s ease',
                  display:      'flex',
                  alignItems:   'center',
                  paddingLeft:  8,
                }}>
                  {widthPct > 15 && (
                    <span style={{
                      fontSize:           'var(--font-size-xs)',
                      fontWeight:         600,
                      color:              '#fff',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {count}
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                width: 40, flexShrink: 0,
                fontSize: 'var(--font-size-xs)',
                color: count > 0 ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
              }}>
                {widthPct <= 15 ? count : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
