import { serverClient } from '../../../lib/supabase-server'
import { HookLibrary } from '../../components/marketing/HookLibrary'
import type { Hook } from '../../components/marketing/HookModal'

export const dynamic = 'force-dynamic'

async function fetchPageData() {
  const db = serverClient()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Marketing agent scope: bouw, daken, dakkapel only.
  const MARKETING_NICHES = ['bouw', 'daken', 'dakkapel']

  const [totalHooks, winnerHooks, creativesWeek, pendingReview, hooksData] = await Promise.all([
    db.from('hooks').select('*', { count: 'exact', head: true }).in('niche', MARKETING_NICHES),
    db.from('hooks').select('*', { count: 'exact', head: true }).eq('status', 'winner').in('niche', MARKETING_NICHES),
    db.from('creatives').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    db.from('creatives').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('hooks').select('*').in('niche', MARKETING_NICHES).order('niche').order('created_at', { ascending: false }),
  ])

  return {
    stats: {
      totalHooks:    totalHooks.count    ?? 0,
      winnerHooks:   winnerHooks.count   ?? 0,
      creativesWeek: creativesWeek.count ?? 0,
      pendingReview: pendingReview.count ?? 0,
    },
    hooks: (hooksData.data ?? []) as Hook[],
  }
}

export default async function MarketingPage() {
  const { stats, hooks } = await fetchPageData()

  const statCards = [
    { label: 'Totaal hooks',    value: String(stats.totalHooks),    sub: 'In hook library'       },
    { label: 'Actieve winners', value: String(stats.winnerHooks),   sub: 'Status: winner'        },
    { label: 'Creatives (7d)', value: String(stats.creativesWeek), sub: 'Gegenereerd deze week' },
    { label: 'Wacht op review', value: String(stats.pendingReview), sub: 'Status: pending'       },
  ]

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
          Marketing
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
          AI Marketing Agent · Hook library &amp; creatives
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        {statCards.map(s => (
          <div key={s.label} style={{
            padding: 16, background: 'var(--color-surface)',
            border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)',
          }}>
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

      {/* Hook library — client component handles mutations */}
      <HookLibrary initialHooks={hooks} />

    </div>
  )
}
