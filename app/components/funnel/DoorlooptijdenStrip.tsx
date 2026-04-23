import type { DoorlooptijdenAggregate } from '../../../lib/metrics'

interface Props {
  data: DoorlooptijdenAggregate
}

const STEPS = [
  { label: 'Lead → Inspectie', key: 'leadToInspection'  as const },
  { label: 'Inspectie → Offerte', key: 'inspectionToQuote' as const },
  { label: 'Offerte → Gewonnen', key: 'quoteToWon'        as const },
]

function fmt(days: number | null): string {
  if (days == null) return '—'
  if (days < 1) return '< 1 dag'
  return `${Math.round(days)} dgn`
}

export function DoorlooptijdenStrip({ data }: Props) {
  const allNull = STEPS.every(s => data[s.key] == null)

  return (
    <div>
    <div style={{ display: 'flex', gap: 0 }}>
      {STEPS.map((step, i) => {
        const val = data[step.key]
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              flex:         1,
              textAlign:    'center',
              padding:      '12px 8px',
              background:   'var(--color-surface)',
              border:       '1px solid var(--color-border)',
              borderRadius: i === 0 ? 'var(--radius-md) 0 0 var(--radius-md)'
                           : i === STEPS.length - 1 ? '0 var(--radius-md) var(--radius-md) 0'
                           : 0,
              borderLeft:   i > 0 ? 'none' : undefined,
            }}>
              <div style={{
                fontSize:           'var(--font-size-xl)',
                fontWeight:         600,
                color:              val != null ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(val)}
              </div>
              <div style={{
                fontSize:   'var(--font-size-xs)',
                color:      'var(--color-ink-faint)',
                marginTop:  4,
              }}>
                {step.label}
              </div>
            </div>

            {i < STEPS.length - 1 && (
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color:    'var(--color-ink-faint)',
                padding:  '0 2px',
                zIndex:   1,
              }}>→</div>
            )}
          </div>
        )
      })}
    </div>
    {allNull && (
      <div style={{
        marginTop:  8,
        fontSize:   'var(--font-size-xs)',
        color:      'var(--color-ink-faint)',
      }}>
        Gemiddelden beschikbaar na 14 dagen status-historie.
      </div>
    )}
    </div>
  )
}
