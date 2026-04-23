import { Sparkline } from './Sparkline'

interface Props {
  label:          string
  value:          string | number | null
  prefix?:        string        // e.g. '€'
  suffix?:        string        // e.g. '%'
  delta?:         number | null // % change vs previous period
  deltaLabel?:    string        // e.g. 'vs vorige maand'
  previousValue?: number | null // absolute previous value — shown in tooltip on delta
  sparkline?:     number[]
  sparkColor?:    string
  subtext?:       string        // secondary line below value
  badges?:        string[]      // inline pill badges below value row
  meta?:          string        // smallest line at very bottom (caveat / context)
  size?:          'sm' | 'md' | 'lg'
}

function fmt(v: number, prefix?: string, suffix?: string): string {
  return `${prefix ?? ''}${v.toLocaleString('nl-NL')}${suffix ?? ''}`
}

function formatValue(value: string | number | null, prefix?: string, suffix?: string): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return fmt(value, prefix, suffix)
  return `${prefix ?? ''}${value}${suffix ?? ''}`
}

interface DeltaBadgeProps {
  delta:          number
  label?:         string
  tooltip?:       string
}

function DeltaBadge({ delta, label, tooltip }: DeltaBadgeProps) {
  const up    = delta >= 0
  const color = up ? 'var(--color-success)' : 'var(--color-critical)'
  const arrow = up ? '↑' : '↓'
  const pct   = `${arrow} ${Math.abs(delta).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%`

  return (
    <span
      title={tooltip}
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        4,
        cursor:     tooltip ? 'help' : 'default',
      }}
    >
      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color }}>
        {pct}
      </span>
      {label && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
          {label}
        </span>
      )}
    </span>
  )
}

export function StatCard({
  label, value, prefix, suffix,
  delta, deltaLabel, previousValue,
  sparkline, sparkColor,
  subtext, badges, meta, size = 'md',
}: Props) {
  const heroSize = size === 'sm' ? 'var(--font-size-2xl)'
    : size === 'lg'              ? 'var(--font-size-4xl)'
    : 'var(--font-size-3xl)'

  // Construct tooltip: "€6.930 → €8.200"
  let deltaTooltip: string | undefined
  if (delta !== null && delta !== undefined && previousValue !== null && previousValue !== undefined && typeof value === 'number') {
    deltaTooltip = `${fmt(previousValue, prefix, suffix)} → ${fmt(value, prefix, suffix)}`
  }

  return (
    <div style={{
      background:    'var(--color-surface)',
      border:        '1px solid var(--color-border)',
      borderRadius:  'var(--radius-lg)',
      padding:       size === 'sm' ? '14px 16px' : '18px 20px',
      display:       'flex',
      flexDirection: 'column',
      gap:           6,
      minWidth:      0,
    }}>
      {/* Label + optional sparkline */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        gap:            8,
      }}>
        <span style={{
          fontSize:      'var(--font-size-xs)',
          fontWeight:    500,
          color:         'var(--color-ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          lineHeight:    1.4,
        }}>
          {label}
        </span>
        {sparkline && sparkline.length >= 2 && (
          <Sparkline
            data={sparkline}
            width={56}
            height={20}
            color={sparkColor ?? 'var(--color-border-strong)'}
          />
        )}
      </div>

      {/* Hero value */}
      <div style={{
        fontSize:           heroSize,
        fontWeight:         600,
        color:              value === null ? 'var(--color-ink-faint)' : 'var(--color-ink)',
        lineHeight:         1.1,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing:      '-0.02em',
      }}>
        {formatValue(value, prefix, suffix)}
      </div>

      {/* Delta / subtext row */}
      {(delta != null || subtext) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {delta != null && (
            <DeltaBadge delta={delta} label={deltaLabel} tooltip={deltaTooltip} />
          )}
          {subtext && delta == null && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
              {subtext}
            </span>
          )}
        </div>
      )}

      {/* Inline badges */}
      {badges && badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {badges.map(b => (
            <span key={b} style={{
              fontSize:     'var(--font-size-2xs)',
              color:        'var(--color-ink-muted)',
              background:   'var(--color-surface-raised)',
              border:       '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding:      '1px 6px',
              whiteSpace:   'nowrap',
            }}>
              {b}
            </span>
          ))}
        </div>
      )}

      {/* Meta line — smallest, caveat/context */}
      {meta && (
        <div style={{
          fontSize:   'var(--font-size-2xs)',
          color:      'var(--color-ink-faint)',
          marginTop:  badges ? 2 : 4,
          lineHeight: 1.3,
        }}>
          {meta}
        </div>
      )}
    </div>
  )
}
