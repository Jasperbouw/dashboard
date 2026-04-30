'use client'

import { useRouter, usePathname } from 'next/navigation'

const NL_MONTHS = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

interface Props {
  value: string  // YYYY-MM
  max:   string  // YYYY-MM — current month, can't navigate past
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

function labelOf(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${NL_MONTHS[m - 1]} ${y}`
}

const btn: React.CSSProperties = {
  background:   'none',
  border:       '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  padding:      '3px 9px',
  fontSize:     'var(--font-size-sm)',
  lineHeight:   1,
  cursor:       'pointer',
}

export function MonthPicker({ value, max }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  function go(ym: string) {
    router.push(`${pathname}?month=${ym}`)
  }

  const atMax = value >= max
  const atMin = monthDiff(value, max) >= 12

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button
        onClick={() => !atMin && go(shiftMonth(value, -1))}
        disabled={atMin}
        style={{ ...btn, color: atMin ? 'var(--color-ink-faint)' : 'var(--color-ink-muted)', cursor: atMin ? 'default' : 'pointer' }}
      >
        ←
      </button>
      <span style={{
        minWidth:    86,
        textAlign:   'center',
        fontSize:    'var(--font-size-sm)',
        fontWeight:  500,
        color:       'var(--color-ink)',
        padding:     '0 6px',
        userSelect:  'none',
      }}>
        {labelOf(value)}
      </span>
      <button
        onClick={() => !atMax && go(shiftMonth(value, 1))}
        disabled={atMax}
        style={{ ...btn, color: atMax ? 'var(--color-ink-faint)' : 'var(--color-ink-muted)', cursor: atMax ? 'default' : 'pointer' }}
      >
        →
      </button>
    </div>
  )
}
