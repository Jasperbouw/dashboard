// Skeleton for the Today page (/). Matches the exact grid structure of page.tsx.

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

function SkeletonCard({ niche }: { niche?: boolean }) {
  return (
    <div style={{
      padding:      '18px 20px',
      background:   'var(--color-surface)',
      border:       '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
    }}>
      {/* Label row */}
      <Skel style={{ height: 9, width: '48%', marginBottom: 10 }} />
      {/* Hero number */}
      <Skel style={{ height: 26, width: '38%', marginBottom: niche ? 8 : 6 }} />
      {/* Niche pill row — only on Leads ontvangen card */}
      {niche && <Skel style={{ height: 9, width: '72%', marginBottom: 6 }} />}
      {/* Diff line */}
      <Skel style={{ height: 9, width: '32%' }} />
    </div>
  )
}

function SectionLabel({ width = 100 }: { width?: number }) {
  return <Skel style={{ height: 9, width, marginBottom: 16 }} />
}

export default function TodayLoading() {
  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <Skel style={{ height: 26, width: 76, marginBottom: 10 }} />
        <Skel style={{ height: 13, width: 210 }} />
      </div>

      {/* ── Section 1: Deze week — 4 pulse cards ───────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <SectionLabel width={88} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <SkeletonCard niche />   {/* Leads ontvangen — has niche breakdown */}
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>

      {/* ── Section 2: Maand pipeline — 4 simple cards ─────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <SectionLabel width={120} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>

      {/* ── Section 3: Commissie pending ────────────────────────────────────── */}
      <div>
        <SectionLabel width={148} />
        <div style={{
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding:      '18px 20px',
        }}>
          <Skel style={{ height: 26, width: 148, marginBottom: 8 }} />
          <Skel style={{ height: 11, width: '58%', marginBottom: 20 }} />
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skel style={{ height: 13, width: '34%' }} />
                <Skel style={{ height: 13, width: '18%' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
