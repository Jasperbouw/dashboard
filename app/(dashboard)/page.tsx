import {
  todayBundle, leadsThisWeek, weeklyMomentum, qualificationStats,
  openOffertesStats, currentMonth, contractorLeaderboard,
} from '../../lib/metrics'
import { getActiveAlerts } from '../../lib/alerts/queries'
import { serverClient } from '../../lib/supabase-server'
import { StatCard } from '../components/ui/StatCard'
import { AlertsFeed } from '../components/today/AlertsFeed'
import { MomentumChart } from '../components/today/MomentumChart'
import { LastSynced } from '../components/today/LastSynced'

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

// Niche display order + Dutch labels
const NICHE_ORDER = ['bouw', 'daken', 'dakkapel', 'extras']
const NICHE_LABEL: Record<string, string> = {
  bouw:     'Bouw',
  daken:    'Daken',
  dakkapel: 'Dakkapel',
  extras:   'Extras',
}

export default async function TodayPage() {
  const range = currentMonth()

  const db = serverClient()
  const { data: lastRun } = await db
    .from('sync_runs')
    .select('started_at')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  const [week, qualStats, offertesStats, bundle, alerts, momentum, leaderboard] = await Promise.all([
    leadsThisWeek(),
    qualificationStats(),
    openOffertesStats(),
    todayBundle(),
    getActiveAlerts({ limit: 100 }),
    weeklyMomentum(8),
    contractorLeaderboard(range),
  ])

  // Leads card badges: breakdown row + niche row
  const leadBadges = [
    `${week.routed} gerouteerd`,
    `${week.inBehandeling} in behandeling`,
    `${week.afgewezen} afgewezen`,
  ]
  const nicheBadges = NICHE_ORDER
    .filter(n => (week.byNiche[n] ?? 0) > 0)
    .map(n => `${NICHE_LABEL[n] ?? n} ${week.byNiche[n]}`)

  // Kwalificatieratio subtext + per-niche badges (Option A: only show % for full_sales niches)
  const qualSubtext = qualStats.ratio != null
    ? `${qualStats.routed} gerouteerd van ${qualStats.routed + qualStats.rejected} beoordeeld`
    : 'Onvoldoende data'
  const qualInBehandelingMeta = qualStats.inBehandeling > 0
    ? `+${qualStats.inBehandeling} in behandeling (niet meegerekend)`
    : undefined
  const filterable = new Set(qualStats.filterableNiches)
  const qualNicheBadges = NICHE_ORDER
    .filter(n => qualStats.byNiche[n])
    .map(n => {
      if (!filterable.has(n)) return `${NICHE_LABEL[n] ?? n} —`
      const s = qualStats.byNiche[n]
      return s.ratio != null ? `${NICHE_LABEL[n] ?? n} ${s.ratio}%` : `${NICHE_LABEL[n] ?? n} —`
    })

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const today = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1280 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{
            fontSize:   'var(--font-size-2xl)',
            fontWeight: 600,
            color:      'var(--color-ink)',
            margin:     0,
          }}>
            Today
          </h1>
          {criticalCount > 0 && (
            <span style={{
              fontSize:     'var(--font-size-xs)',
              fontWeight:   600,
              color:        'var(--color-critical)',
              background:   'var(--color-critical-subtle)',
              borderRadius: 'var(--radius-full)',
              padding:      '2px 8px',
            }}>
              {criticalCount} kritiek
            </span>
          )}
        </div>
        <p style={{
          fontSize:  'var(--font-size-sm)',
          color:     'var(--color-ink-muted)',
          marginTop: 4,
          display:   'flex', alignItems: 'center', gap: 8,
          textTransform: 'capitalize',
        }}>
          {today}
          <LastSynced syncedAt={lastRun?.started_at ?? null} />
        </p>
      </div>

      {/* ── Top StatCards ── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap:                 12,
        marginBottom:        36,
      }}>
        {/* 1. Leads deze week */}
        <StatCard
          label="Leads deze week"
          value={week.total}
          delta={week.trend}
          deltaLabel="vs vorige week"
          previousValue={week.previous}
          sparkline={momentum.slice(-6).map(w => w.count)}
          badges={[...leadBadges, ...nicheBadges]}
        />

        {/* 2. Kwalificatieratio */}
        <StatCard
          label="Kwalificatieratio"
          value={qualStats.ratio}
          suffix="%"
          subtext={qualSubtext}
          badges={qualNicheBadges}
          meta={qualInBehandelingMeta}
        />

        {/* 3. Open offertes — count only until quote_amount is populated */}
        <StatCard
          label="Open offertes"
          value={offertesStats.total}
          subtext="Bedragen nog niet geregistreerd"
          meta={`Waarvan ${offertesStats.fullSalesCount} bij full-sales klanten`}
        />

        {/* 4. Commissie MTD — projects marked 'betaald' created this month
              Note: filtered by project monday_created_at (no paid_at column yet).
              Commission state machine:
                quote_sent lead    → potential (not tracked until Aanneemsom capture)
                project, not paid  → EARNED, awaiting payout ("Commissie pending")
                project, betaald   → PAID this month ("Commissie MTD")
              TODO: once quote_amount capture is active for full_sales contractors,
              add a third card "Potentiële commissie" (weighted pipeline forecast).
              Three-card row: MTD (paid) / Pending (earned) / Potential (forecast). */}
        <StatCard
          label="Commissie MTD"
          value={bundle.totalCommissionBooked || null}
          prefix="€"
          subtext="bevestigd en geboekt"
        />

        {/* 5. Commissie pending — all projects with commissie > 0 and not yet paid.
              These are WON deals where our commission is earned but contractor
              hasn't paid out yet. No date filter — snapshot of all outstanding. */}
        <StatCard
          label="Commissie pending"
          value={bundle.totalCommissionPending || null}
          prefix="€"
          subtext="verdiend, wacht op uitbetaling"
        />
      </div>

      {/* ── Alerts ── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   16,
        }}>
          <SectionTitle>Meldingen</SectionTitle>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
            {alerts.length} actief
          </span>
        </div>
        <AlertsFeed initialAlerts={alerts} />
      </div>

      {/* ── Momentum chart ── */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Weekmomentum — afgelopen 8 weken</SectionTitle>
        </div>
        <div style={{
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding:      '20px 20px 16px',
        }}>
          <MomentumChart data={momentum} />
          <div style={{
            display:    'flex',
            gap:        24,
            marginTop:  16,
            paddingTop: 12,
            borderTop:  '1px solid var(--color-border-subtle)',
          }}>
            {[
              { label: 'CPL', value: null },
              { label: 'CPQL', value: null },
              { label: 'Kosten per inspectie', value: null },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{
                  fontSize:      'var(--font-size-2xs)',
                  color:         'var(--color-ink-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize:           'var(--font-size-md)',
                  color:              'var(--color-ink-faint)',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop:          2,
                }}>
                  {value ?? '—'}
                </div>
              </div>
            ))}
            <div style={{
              marginLeft: 'auto',
              fontSize:   'var(--font-size-xs)',
              color:      'var(--color-ink-faint)',
              alignSelf:  'flex-end',
            }}>
              Meta niet gekoppeld
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
