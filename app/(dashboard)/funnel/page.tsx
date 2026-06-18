import {
  cachedCurrentStageDistribution,
  cachedNichePerformance,
  currentMonth,
} from '../../../lib/metrics'
import { DateRangePicker } from '../../components/ui/DateRangePicker'
import { PipelineView }    from '../../components/funnel/PipelineView'
import { NicheBreakdown }  from '../../components/funnel/NicheBreakdown'

export const dynamic = 'force-dynamic'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 'var(--font-size-xs)', fontWeight: 600,
      color: 'var(--color-ink-faint)', textTransform: 'uppercase',
      letterSpacing: '0.08em', margin: 0,
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

interface Props {
  searchParams: Promise<{ from?: string; to?: string }>
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

function periodLabel(from: string, to: string): string {
  const now   = new Date()
  const today = isoDate(now)
  const y     = now.getFullYear()
  const m     = now.getMonth()

  if (from === isoDate(new Date(y, m, 1)) && to === isoDate(new Date(y, m + 1, 0))) return 'Deze maand'
  if (from === `${y}-01-01` && to === today) return 'Dit jaar'
  const dow  = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monStart = isoDate(new Date(now.getTime() - dow * 86_400_000))
  if (from === monStart && to === today) return 'Deze week'
  return `${from} t/m ${to}`
}

export default async function FunnelPage({ searchParams }: Props) {
  const params = await searchParams

  const def     = currentMonth()
  const fromStr = params.from ?? def.from.toISOString().slice(0, 10)
  const toStr   = params.to   ?? def.to.toISOString().slice(0, 10)
  const fromISO = (params.from ? new Date(params.from) : def.from).toISOString()
  const toISO   = (params.to   ? new Date(params.to + 'T23:59:59.999Z') : def.to).toISOString()

  const [distribution, niches] = await Promise.all([
    cachedCurrentStageDistribution(fromISO, toISO),
    cachedNichePerformance(fromISO, toISO),
  ])

  const totalLeads = Object.values(distribution.counts).reduce((s, v) => s + v, 0)
  const label      = periodLabel(fromStr, toStr)

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>Funnel</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
            Huidige verdeling van leads
          </p>
        </div>
        <DateRangePicker from={fromStr} to={toStr} />
      </div>

      {/* Pipeline */}
      <Card style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>Huidige verdeling</SectionTitle>
        </div>
        <PipelineView distribution={distribution} />
      </Card>

      {/* Niche breakdown */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <SectionTitle>Verdeling per niche</SectionTitle>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
          — {totalLeads} leads ({label})
        </span>
      </div>
      <NicheBreakdown niches={niches} />

    </div>
  )
}
