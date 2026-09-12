'use client'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartTooltip, Legend,
} from 'recharts'

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const BW_COLOR = '#4f7df3'
const GT_COLOR = '#3fb950'

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
type YtdContractorRow = { id: string; name: string; niche: string; dealValue: number; commission: number }

interface Props {
  trend:           TrendItem[]
  gtTrend:         TrendItem[]
  ytdByContractor: YtdContractorRow[]
  selectedMonth:   string
  periodLabel:     string
  currentYear:     number
}

function CompTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
      borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--color-ink)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.fill, marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{fmtEur(p.value)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--color-ink-muted)', marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--color-border-subtle)' }}>
          <span>Totaal</span>
          <span style={{ fontWeight: 600 }}>{fmtEur(payload[0].value + payload[1].value)}</span>
        </div>
      )}
    </div>
  )
}

export function FinanceCharts({ trend, gtTrend, ytdByContractor, selectedMonth, periodLabel, currentYear }: Props) {

  // Merge bw + gt into grouped data for the dual-bar chart
  const compTrend = trend.map((bw, i) => ({
    month: bw.month,
    label: bw.label,
    bw:    bw.amount,
    gt:    gtTrend[i]?.amount ?? 0,
  }))
  const hasCompData = compTrend.some(c => c.bw > 0 || c.gt > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Dual-bar commissie trend */}
      {hasCompData && (
        <Card>
          <SectionTitle>Commissie 6 maanden — Bouwcheck vs GreenTeam</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={compTrend} barCategoryGap="25%" barGap={3}>
              <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} tick={{ fill: '#8b949e', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
              <RechartTooltip content={<CompTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#8b949e', paddingTop: 8 }} />
              <Bar dataKey="bw" name="Bouwcheck" fill={BW_COLOR} radius={[4, 4, 0, 0]} minPointSize={2} />
              <Bar dataKey="gt" name="GreenTeam"  fill={GT_COLOR} radius={[4, 4, 0, 0]} minPointSize={2} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

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
