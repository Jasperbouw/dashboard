import {
  currentStageDistribution,
  campaignPerformance,
  nichePerformance,
  funnelTransitions,
  doorlooptijdenAggregate,
  currentMonth,
  type TimeRange,
} from '../../../lib/metrics'
import { DateRangePicker }        from '../../components/ui/DateRangePicker'
import { StageDistributionChart } from '../../components/funnel/StageDistributionChart'
import { ConversionFunnel }       from '../../components/funnel/ConversionFunnel'
import { NicheBreakdown }         from '../../components/funnel/NicheBreakdown'
import { CampaignTable }          from '../../components/funnel/CampaignTable'
import { DoorlooptijdenStrip }    from '../../components/funnel/DoorlooptijdenStrip'

export const dynamic = 'force-dynamic'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize:      'var(--font-size-xs)',
      fontWeight:    600,
      color:         'var(--color-ink-faint)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      margin:        0,
    }}>
      {children}
    </h2>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding:      '20px',
      ...style,
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

  const thisMonthFrom = isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
  const thisMonthTo   = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const lastMonthFrom = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const lastMonthTo   = isoDate(new Date(now.getFullYear(), now.getMonth(), 0))
  const last30From    = isoDate(new Date(now.getTime() - 30 * 86_400_000))
  const last90From    = isoDate(new Date(now.getTime() - 90 * 86_400_000))
  const ytdFrom       = `${now.getFullYear()}-01-01`

  if (from === thisMonthFrom && to === thisMonthTo) return 'Deze maand'
  if (from === lastMonthFrom && to === lastMonthTo) return 'Vorige maand'
  if (from === last30From    && to === today)       return 'Laatste 30 dagen'
  if (from === last90From    && to === today)       return 'Laatste 90 dagen'
  if (from === ytdFrom       && to === today)       return 'Dit jaar'
  return `${from} t/m ${to}`
}

export default async function FunnelPage({ searchParams }: Props) {
  const params = await searchParams

  const def      = currentMonth()
  const fromDate = params.from ? new Date(params.from) : def.from
  const toDate   = params.to   ? new Date(params.to)   : def.to
  const fromStr  = params.from ?? def.from.toISOString().slice(0, 10)
  const toStr    = params.to   ?? def.to.toISOString().slice(0, 10)
  const range: TimeRange = { from: fromDate, to: toDate }

  const [distribution, campaigns, niches, funnel, doorlooptijden] = await Promise.all([
    currentStageDistribution(range),
    campaignPerformance(range),
    nichePerformance(range),
    funnelTransitions(range),
    doorlooptijdenAggregate(range),
  ])

  const totalLeads = Object.values(distribution.counts).reduce((s, v) => s + v, 0)
  const label      = periodLabel(fromStr, toStr)

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1280 }}>

      {/* ── Header ── */}
      <div style={{
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        marginBottom:   32,
        gap:            16,
        flexWrap:       'wrap',
      }}>
        <div>
          <h1 style={{
            fontSize:   'var(--font-size-2xl)',
            fontWeight: 600,
            color:      'var(--color-ink)',
            margin:     0,
          }}>
            Funnel
          </h1>
          <p style={{
            fontSize:  'var(--font-size-sm)',
            color:     'var(--color-ink-muted)',
            marginTop: 4,
          }}>
            Campagneprestaties en conversiestadia
          </p>
        </div>

        <DateRangePicker from={fromStr} to={toStr} />
      </div>

      {/* ── Doorlooptijden strip ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 12 }}>
          <SectionTitle>Gemiddelde doorlooptijden</SectionTitle>
        </div>
        <DoorlooptijdenStrip data={doorlooptijden} />
      </div>

      {/* ── Two-column: Stage distribution + Conversion funnel ── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:                 20,
        marginBottom:        28,
      }}>
        <Card>
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Huidige verdeling</SectionTitle>
          </div>
          <StageDistributionChart distribution={distribution} />
        </Card>

        <Card>
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Conversiefunnel — {fromStr} t/m {toStr}</SectionTitle>
          </div>
          <ConversionFunnel result={funnel} />
        </Card>
      </div>

      {/* ── Niche + campaign section header ── */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <SectionTitle>Verdeling, niches &amp; campagnes</SectionTitle>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
          — {totalLeads} leads ({label})
        </span>
      </div>

      {/* ── Niche breakdown ── */}
      <div style={{ marginBottom: 28 }}>
        <NicheBreakdown niches={niches} />
      </div>

      {/* ── Campaign table ── */}
      <div>
        <CampaignTable campaigns={campaigns} />
      </div>

    </div>
  )
}
