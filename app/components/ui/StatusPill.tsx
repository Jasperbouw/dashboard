export type CanonicalStage =
  | 'new' | 'contacted' | 'inspection' | 'quote_sent'
  | 'won' | 'deferred' | 'lost'

export type HealthStatus =
  | 'active' | 'on-track' | 'warning' | 'critical'
  | 'at_risk' | 'winding_down' | 'idle'

export type CommissionModel = 'percentage' | 'flat_fee' | 'retainer'

export type PillVariant = CanonicalStage | HealthStatus | CommissionModel | string

interface PillStyle {
  bg:    string
  text:  string
  label: string
}

const STYLES: Record<string, PillStyle> = {
  // ── Canonical lead stages ─────────────────────────────────────────
  // Colors reflect emotional meaning, not funnel depth.
  // Green = momentum/progress; purple spectrum = close to win;
  // amber = problems; grey = dormant.
  new:          { bg: 'var(--color-idle-subtle)',      text: 'var(--color-idle)',     label: 'Nieuw' },
  contacted:    { bg: 'var(--color-info-subtle)',      text: 'var(--color-info)',     label: 'Gebeld' },
  inspection:   { bg: 'var(--color-success-subtle)',   text: 'var(--color-success)',  label: 'Inspectie' },
  quote_sent:   { bg: 'var(--color-quote-subtle)',     text: 'var(--color-quote)',    label: 'Offerte' },
  won:          { bg: 'var(--color-won-subtle)',        text: 'var(--color-won)',      label: 'Gewonnen' },
  deferred:     { bg: 'var(--color-warning-subtle)',   text: 'var(--color-warning)',  label: 'Uitgesteld' },
  lost:         { bg: 'var(--color-critical-subtle)',  text: 'var(--color-critical)', label: 'Verloren' },

  // ── Health / relationship status ──────────────────────────────────
  active:       { bg: 'var(--color-success-subtle)',  text: 'var(--color-success)',  label: 'Actief' },
  'on-track':   { bg: 'var(--color-success-subtle)',  text: 'var(--color-success)',  label: 'On track' },
  warning:      { bg: 'var(--color-warning-subtle)',  text: 'var(--color-warning)',  label: 'Aandacht' },
  critical:     { bg: 'var(--color-critical-subtle)', text: 'var(--color-critical)', label: 'Kritiek' },
  at_risk:      { bg: 'var(--color-critical-subtle)', text: 'var(--color-critical)', label: 'In gevaar' },
  winding_down: { bg: 'var(--color-idle-subtle)',      text: 'var(--color-idle)',     label: 'Aflopend' },
  idle:         { bg: 'var(--color-idle-subtle)',      text: 'var(--color-idle)',     label: 'Inactief' },

  // ── Commission model ──────────────────────────────────────────────
  percentage:   { bg: 'var(--color-info-subtle)',      text: 'var(--color-info)',      label: 'Commissie %' },
  flat_fee:     { bg: 'var(--color-surface-raised)',   text: 'var(--color-ink-muted)', label: 'Flat fee' },
  retainer:     { bg: 'var(--color-surface-raised)',   text: 'var(--color-ink-muted)', label: 'Retainer' },
}

const FALLBACK: PillStyle = {
  bg: 'var(--color-surface-raised)', text: 'var(--color-ink-muted)', label: '—',
}

interface Props {
  variant:  PillVariant
  label?:   string    // override the default label
  dot?:     boolean   // default true — use false only in tight table cells
  size?:    'xs' | 'sm' | 'md'
}

export function StatusPill({ variant, label, dot = true, size = 'sm' }: Props) {
  const style = STYLES[variant] ?? FALLBACK
  const text  = label ?? style.label

  const padding  = size === 'xs' ? '1px 6px'  : size === 'sm' ? '2px 8px'  : '3px 10px'
  const fontSize = size === 'xs' ? 'var(--font-size-2xs)' : size === 'sm' ? 'var(--font-size-xs)' : 'var(--font-size-sm)'
  const dotSize  = size === 'xs' ? 4 : 5

  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           dot ? 5 : 0,
        padding,
        fontSize,
        fontWeight:    500,
        lineHeight:    1.6,
        borderRadius:  'var(--radius-full)',
        background:    style.bg,
        color:         style.text,
        whiteSpace:    'nowrap',
        letterSpacing: '0.01em',
        flexShrink:    0,
      }}
    >
      {dot && (
        <span style={{
          width:        dotSize,
          height:       dotSize,
          borderRadius: '50%',
          background:   style.text,
          flexShrink:   0,
        }} />
      )}
      {text}
    </span>
  )
}
