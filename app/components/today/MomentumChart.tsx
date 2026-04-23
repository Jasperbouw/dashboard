'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { WeekBucket } from '../../../lib/metrics'

interface Props {
  data: WeekBucket[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:   'var(--color-surface-raised)',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding:      '8px 12px',
      fontSize:     'var(--font-size-xs)',
      color:        'var(--color-ink)',
    }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ color: 'var(--color-ink-muted)', marginTop: 2 }}>
        {payload[0].value} leads
      </div>
    </div>
  )
}

export function MomentumChart({ data }: Props) {
  const max = Math.max(...data.map(d => d.count), 1)
  const isCurrentWeek = (_: WeekBucket, i: number) => i === data.length - 1

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barSize={20} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--color-ink-faint)', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--color-ink-faint)', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'var(--color-surface-raised)' }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={entry.from}
              fill={isCurrentWeek(entry, i) ? 'var(--color-info)' : 'var(--color-border-strong)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
