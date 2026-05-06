import { serverClient } from '../../../lib/supabase-server'
import { WinnersLibrary } from '../../components/marketing/WinnersLibrary'
import { DailyFeed } from '../../components/marketing/DailyFeed'
import { ApprovedArchive } from '../../components/marketing/ApprovedArchive'
import type { Winner } from '../../components/marketing/types'

export const dynamic = 'force-dynamic'

const REJECTION_LABEL: Record<string, string> = {
  boring:        'Saai / geen trigger',
  off_brand:     'Niet passend bij merk',
  wrong_text:    'Tekst overlay klopt niet',
  wrong_niche:   'Verkeerde niche / context',
  fluff:         'Te vaag / fluff copy',
  unrealistic:   'Onrealistisch beeld',
  wrong_overlay: 'Overlay slecht geplaatst',
  other:         'Anders',
}

async function fetchPageData() {
  const db      = serverClient()
  const now     = new Date()
  const weekAgo = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()
  const fortAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [totalWinners, bestCpl, creativesWeek, pendingReview, rejectionsData, winnersData] = await Promise.all([
    db.from('winners').select('*', { count: 'exact', head: true }).eq('is_winner', true),
    db.from('winners').select('cpl').eq('is_winner', true).order('cpl', { ascending: true }).limit(1),
    db.from('creatives').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    db.from('creatives').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('creatives').select('rejection_reason').eq('status', 'rejected').not('rejection_reason', 'is', null).gte('reviewed_at', fortAgo),
    db.from('winners').select('*').order('uploaded_at', { ascending: false }),
  ])

  const minCpl = (bestCpl.data?.[0]?.cpl ?? null) as number | null

  // Count rejections per reason to find top reason
  const rejCounts: Record<string, number> = {}
  for (const row of rejectionsData.data ?? []) {
    const r = (row as { rejection_reason: string }).rejection_reason
    rejCounts[r] = (rejCounts[r] ?? 0) + 1
  }
  const topReason = Object.entries(rejCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    stats: {
      totalWinners:    totalWinners.count ?? 0,
      bestCpl:         minCpl,
      creativesWeek:   creativesWeek.count ?? 0,
      pendingReview:   pendingReview.count ?? 0,
      rejections14d:   rejectionsData.count ?? (rejectionsData.data?.length ?? 0),
      topRejection:    topReason,
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
    { label: 'Totaal winners',  value: String(stats.totalWinners),  sub: 'CPL ≤ €12' },
    { label: 'Beste CPL',       value: fmtCpl(stats.bestCpl),       sub: 'Laagste CPL ooit' },
    {
      label: 'Creatives (7d)',
      value: String(stats.creativesWeek),
      sub: 'Gegenereerd deze week',
      tooltip: '~€0,40 per dag aan AI kosten (Claude + Gemini)',
    },
    { label: 'Wacht op review', value: String(stats.pendingReview), sub: 'Status: pending' },
    {
      label: 'Afwijzingen 14d',
      value: String(stats.rejections14d),
      sub: stats.topRejection ? `Meest: ${REJECTION_LABEL[stats.topRejection] ?? stats.topRejection}` : 'Geen afwijzingen',
    },
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 32 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ padding: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              {s.label}
              {'tooltip' in s && (
                <span title={s.tooltip} style={{ cursor: 'help', color: 'var(--color-ink-faint)', fontSize: 10, border: '1px solid var(--color-border)', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  i
                </span>
              )}
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

      {/* Daily output feed */}
      <DailyFeed />

      {/* Approved archive */}
      <ApprovedArchive />

    </div>
  )
}
