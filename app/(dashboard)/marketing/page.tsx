import { serverClient } from '../../../lib/supabase-server'
import { WinnersLibrary } from '../../components/marketing/WinnersLibrary'
import type { Winner } from '../../components/marketing/types'

export const dynamic = 'force-dynamic'

async function fetchPageData() {
  const db  = serverClient()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [totalWinners, bestCpl, creativesWeek, pendingReview, winnersData] = await Promise.all([
    db.from('winners').select('*', { count: 'exact', head: true }).eq('is_winner', true),
    db.from('winners').select('cpl').eq('is_winner', true).order('cpl', { ascending: true }).limit(1),
    db.from('creatives').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    db.from('creatives').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('winners').select('*').order('uploaded_at', { ascending: false }),
  ])

  const minCpl = (bestCpl.data?.[0]?.cpl ?? null) as number | null

  return {
    stats: {
      totalWinners:  totalWinners.count ?? 0,
      bestCpl:       minCpl,
      creativesWeek: creativesWeek.count ?? 0,
      pendingReview: pendingReview.count ?? 0,
    },
    winners: (winnersData.data ?? []) as Winner[],
  }
}

function fmtCpl(v: number | null) {
  if (v === null) return '—'
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function MarketingPage() {
  const { stats, winners } = await fetchPageData()

  const statCards = [
    { label: 'Totaal winners',    value: String(stats.totalWinners),        sub: 'CPL ≤ €12'                 },
    { label: 'Beste CPL',         value: fmtCpl(stats.bestCpl),             sub: 'Laagste CPL ooit'          },
    { label: 'Creatives (7d)',    value: String(stats.creativesWeek),       sub: 'Gegenereerd deze week'     },
    { label: 'Wacht op review',   value: String(stats.pendingReview),       sub: 'Status: pending'           },
  ]

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
          Marketing
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
          AI Marketing Agent · Winners &amp; daily output
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ padding: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
              {s.value}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Winners library */}
      <WinnersLibrary initialWinners={winners} />

      {/* Daily output feed — Phase 2 placeholder */}
      <div style={{
        marginTop: 24,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)', marginBottom: 8 }}>
          Daily output feed
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
          Output verschijnt hier zodra de generation engine draait — Phase 2
        </div>
      </div>

    </div>
  )
}
