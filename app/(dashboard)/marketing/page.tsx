import { serverClient } from '../../../lib/supabase-server'

export const dynamic = 'force-dynamic'

async function fetchStats() {
  const db = serverClient()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [totalHooks, winnerHooks, creativesWeek, pendingReview] = await Promise.all([
    db.from('hooks').select('*', { count: 'exact', head: true }),
    db.from('hooks').select('*', { count: 'exact', head: true }).eq('status', 'winner'),
    db.from('creatives').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    db.from('creatives').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return {
    totalHooks:    totalHooks.count    ?? 0,
    winnerHooks:   winnerHooks.count   ?? 0,
    creativesWeek: creativesWeek.count ?? 0,
    pendingReview: pendingReview.count ?? 0,
  }
}

export default async function MarketingPage() {
  const stats = await fetchStats()

  const statCards = [
    { label: 'Totaal hooks',      value: String(stats.totalHooks),    sub: 'In hook library'       },
    { label: 'Actieve winners',   value: String(stats.winnerHooks),   sub: 'Status: winner'        },
    { label: 'Creatives (7d)',    value: String(stats.creativesWeek), sub: 'Gegenereerd deze week' },
    { label: 'Wacht op review',   value: String(stats.pendingReview), sub: 'Status: pending'       },
  ]

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize:   'var(--font-size-2xl)',
          fontWeight: 600,
          color:      'var(--color-ink)',
          margin:     0,
        }}>
          Marketing
        </h1>
        <p style={{
          fontSize:  'var(--font-size-sm)',
          color:     'var(--color-ink-muted)',
          marginTop: 4,
          marginBottom: 0,
        }}>
          AI Marketing Agent · Hook library &amp; creatives
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        {statCards.map(s => (
          <div key={s.label} style={{
            padding:      16,
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{
              fontSize:      'var(--font-size-2xs)',
              fontWeight:    600,
              color:         'var(--color-ink-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom:  6,
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize:           'var(--font-size-2xl)',
              fontWeight:         600,
              color:              'var(--color-ink)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {s.value}
            </div>
            <div style={{
              fontSize:  'var(--font-size-xs)',
              color:     'var(--color-ink-faint)',
              marginTop: 4,
            }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Hook library — empty state */}
      <div style={{
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow:     'hidden',
      }}>
        {/* Section header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '14px 20px',
          borderBottom:   '1px solid var(--color-border-subtle)',
        }}>
          <span style={{
            fontSize:   'var(--font-size-sm)',
            fontWeight: 600,
            color:      'var(--color-ink)',
          }}>
            Hook library
          </span>
          {/* Placeholder button — hook management UI comes in Phase 2 */}
          <button
            disabled
            title="Coming in Phase 2"
            style={{
              padding:      '6px 14px',
              background:   'var(--color-accent)',
              color:        '#fff',
              border:       'none',
              borderRadius: 'var(--radius-sm)',
              fontSize:     'var(--font-size-xs)',
              fontWeight:   500,
              cursor:       'not-allowed',
              opacity:      0.4,
            }}
          >
            + Nieuwe hook
          </button>
        </div>

        {stats.totalHooks === 0 ? (
          /* Empty state */
          <div style={{ padding: '56px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.25 }}>✦</div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', margin: 0 }}>
              Hook library is leeg. Begin met hooks toevoegen om de agent te starten.
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 6, marginBottom: 0 }}>
              Hook management beschikbaar in Phase 2
            </p>
          </div>
        ) : (
          /* Hooks loaded — full list UI comes in Phase 2 */
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', margin: 0 }}>
              {stats.totalHooks} hooks geladen. Hook management UI beschikbaar in Phase 2.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
