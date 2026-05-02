// Skeleton for the Funnel page (/funnel). Matches the exact layout of page.tsx.

function Skel({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      className="animate-pulse"
      style={{
        background:   'var(--color-border)',
        borderRadius: 'var(--radius-md)',
        ...style,
      }}
    />
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

// Campaign/niche table column widths — matches real CampaignTable columns:
// campaign_tag, niche, leads, routed, inspecties, offertes, gewonnen
const COL_WIDTHS = [160, 70, 52, 52, 70, 60, 70]

export default function FunnelLoading() {
  return (
    <div style={{ padding: '32px 36px', maxWidth: 1280 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        marginBottom:   32,
        gap:            16,
        flexWrap:       'wrap',
      }}>
        <div>
          <Skel style={{ height: 26, width: 80, marginBottom: 10 }} />
          <Skel style={{ height: 13, width: 248 }} />
        </div>
        {/* DateRangePicker placeholder */}
        <Skel style={{ height: 32, width: 224, borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
      </div>

      {/* ── Doorlooptijden strip — 3 joined tiles ──────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <Skel style={{ height: 9, width: 188, marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            'Lead → Inspectie',
            'Inspectie → Offerte',
            'Offerte → Gewonnen',
          ].map((_, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{
                flex:         1,
                padding:      '12px 8px',
                background:   'var(--color-surface)',
                border:       '1px solid var(--color-border)',
                borderRadius: i === 0 ? 'var(--radius-md) 0 0 var(--radius-md)'
                             : i === 2 ? '0 var(--radius-md) var(--radius-md) 0'
                             : 0,
                borderLeft:   i > 0 ? 'none' : undefined,
                textAlign:    'center',
              }}>
                <Skel style={{ height: 22, width: 56, margin: '0 auto 6px' }} />
                <Skel style={{ height: 9,  width: 96, margin: '0 auto' }} />
              </div>
              {i < 2 && (
                <div style={{
                  width: 12, textAlign: 'center', flexShrink: 0,
                  color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)',
                }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column: stage distribution + conversion funnel ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Stage distribution — horizontal bar chart */}
        <Card>
          <Skel style={{ height: 9, width: 140, marginBottom: 20 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[72, 100, 52, 38, 22, 16, 10].map((pct, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Skel style={{ height: 9, width: 64, flexShrink: 0 }} />
                <Skel style={{ height: 14, width: `${pct}%` }} />
                <Skel style={{ height: 9, width: 28, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </Card>

        {/* Conversion funnel — tapering bars */}
        <Card>
          <Skel style={{ height: 9, width: 220, marginBottom: 20 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 72, bar: 100, rate: 0 },
              { label: 72, bar: 80,  rate: 36 },
              { label: 72, bar: 52,  rate: 36 },
              { label: 72, bar: 32,  rate: 36 },
              { label: 72, bar: 18,  rate: 36 },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Skel style={{ height: 10, width: row.label, flexShrink: 0 }} />
                <div style={{ flex: 1, height: 24, position: 'relative' }}>
                  <Skel style={{ height: 24, width: `${row.bar}%` }} />
                </div>
                {row.rate > 0 && (
                  <Skel style={{ height: 10, width: row.rate, flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Section header: niches & campaigns ─────────────────────────────── */}
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Skel style={{ height: 9, width: 188 }} />
        <Skel style={{ height: 9, width: 120 }} />
      </div>

      {/* ── Niche breakdown — 4 rows (bouw, dakkapel, daken, extras) ───────── */}
      <div style={{ marginBottom: 28 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            padding:      '12px 0',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}>
            {/* Row header: niche label + progress bar + stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Skel style={{ height: 11, width: 72, flexShrink: 0 }} />
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--color-border-subtle)', position: 'relative', overflow: 'hidden' }}>
                <Skel style={{ height: 6, width: `${[65, 45, 80, 25][i]}%`, borderRadius: 3 }} />
              </div>
              <Skel style={{ height: 11, width: 32, flexShrink: 0 }} />
              <Skel style={{ height: 11, width: 40, flexShrink: 0 }} />
              <Skel style={{ height: 11, width: 40, flexShrink: 0 }} />
              <Skel style={{ height: 11, width: 40, flexShrink: 0 }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Campaign table ──────────────────────────────────────────────────── */}
      <div style={{
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow:     'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display:      'flex',
          gap:          16,
          padding:      '10px 16px',
          borderBottom: '1px solid var(--color-border)',
          background:   'var(--color-surface-raised)',
        }}>
          {COL_WIDTHS.map((w, i) => (
            <Skel key={i} style={{ height: 9, width: w, flexShrink: 0 }} />
          ))}
        </div>

        {/* Table rows — 6 rows covers typical campaign count */}
        {[0, 1, 2, 3, 4, 5].map(row => (
          <div key={row} style={{
            display:      'flex',
            gap:          16,
            padding:      '11px 16px',
            borderBottom: row < 5 ? '1px solid var(--color-border-subtle)' : undefined,
          }}>
            {COL_WIDTHS.map((w, i) => (
              <Skel key={i} style={{ height: 11, width: w, flexShrink: 0 }} />
            ))}
          </div>
        ))}
      </div>

    </div>
  )
}
