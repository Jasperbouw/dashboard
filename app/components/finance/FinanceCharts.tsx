'use client'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartTooltip, Cell,
} from 'recharts'

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const ACCENT = '#4f7df3'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 'var(--font-size-xs)', fontWeight: 600,
      color: 'var(--color-ink-faint)', textTransform: 'uppercase',
      letterSpacing: '0.08em', margin: 0, marginBottom: 16,
    }}>
      {children}
    </h2>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '20px 24px', ...style,
    }}>
      {children}
    </div>
  )
}

const th: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', fontWeight: 600,
  color: 'var(--color-ink-faint)', textTransform: 'uppercase',
  letterSpacing: '0.06em', paddingBottom: 10,
  borderBottom: '1px solid var(--color-border-subtle)',
}

type TrendItem        = { month: string; label: string; amount: number }
type Top5Item         = { id: string; name: string; niche: string; model: string; amount: number; dealValue: number }
type YtdContractorRow = { id: string; name: string; niche: string; dealValue: number; commission: number }

interface Props {
  trend:             TrendItem[]
  top5:              Top5Item[]
  ytdByContractor:   YtdContractorRow[]
  selectedMonth:     string
  periodLabel:       string
  currentYear:       number
}

function EurTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
      borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--color-ink)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div>{fmtEur(payload[0].value)}</div>
    </div>
  )
}

export function FinanceCharts({ trend, top5, ytdByContractor, selectedMonth, periodLabel, currentYear }: Props) {
  const hasData = trend.some(t => t.amount > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Trend — last 6 months */}
      <Card>
        <SectionTitle>Commissie laatste 6 maanden</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trend} barCategoryGap="30%">
            <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} tick={{ fill: '#8b949e', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
            <RechartTooltip content={<EurTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} minPointSize={4}>
              {trend.map(entry => (
                <Cell key={entry.month} fill={ACCENT} fillOpacity={entry.amount > 0 ? (entry.month === selectedMonth ? 1 : 0.4) : 0.15} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {!hasData && (
          <p style={{ textAlign: 'center', fontSize: 'var(--font-size-sm)', color: '#8b949e', marginTop: 8 }}>
            Nog geen deals geboekt in deze periode
          </p>
        )}
      </Card>

      {/* Top aannemers deze maand */}
      <Card>
        <SectionTitle>Top aannemers — {periodLabel}</SectionTitle>
        {top5.every(r => r.dealValue === 0) ? (
          <p style={{ fontSize: 'var(--font-size-sm)', color: '#8b949e' }}>Geen data</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Aannemer', 'Niche', 'Model', 'Omzet', 'Commissie'].map(h => (
                  <th key={h} style={{ ...th, textAlign: ['Omzet', 'Commissie'].includes(h) ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top5.filter(r => r.dealValue > 0).map((row, i) => (
                <tr key={row.id} style={{ borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : undefined }}>
                  <td style={{ padding: '10px 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: '10px 0 10px 16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>{row.niche}</td>
                  <td style={{ padding: '10px 0 10px 16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
                    {row.model === 'percentage' ? '%' : row.model === 'flat_fee' ? 'Flat' : row.model === 'retainer' ? 'Ret.' : '—'}
                  </td>
                  <td style={{ padding: '10px 0 10px 16px', textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtEur(row.dealValue)}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtEur(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* YTD per aannemer */}
      <Card>
        <SectionTitle>Aannemers YTD {currentYear}</SectionTitle>
        {ytdByContractor.length === 0 ? (
          <p style={{ fontSize: 'var(--font-size-sm)', color: '#8b949e' }}>Geen data dit jaar</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Aannemer', 'Niche', 'Omzet YTD', 'Commissie YTD'].map(h => (
                  <th key={h} style={{ ...th, textAlign: ['Omzet YTD', 'Commissie YTD'].includes(h) ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ytdByContractor.map((row, i) => (
                <tr key={row.id} style={{ borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : undefined }}>
                  <td style={{ padding: '10px 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: '10px 0 10px 16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>{row.niche}</td>
                  <td style={{ padding: '10px 0 10px 16px', textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtEur(row.dealValue)}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtEur(row.commission)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

    </div>
  )
}
