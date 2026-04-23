import { StatusPill, type PillVariant } from '../components/ui/StatusPill'
import { StatCard } from '../components/ui/StatCard'
import { Sparkline } from '../components/ui/Sparkline'

const SWATCH_DATA: { name: string; var: string; hex: string }[] = [
  { name: 'canvas',         var: '--color-canvas',         hex: '#0f1117' },
  { name: 'surface',        var: '--color-surface',        hex: '#161b22' },
  { name: 'surface-raised', var: '--color-surface-raised', hex: '#1c2128' },
  { name: 'border',         var: '--color-border',         hex: '#30363d' },
  { name: 'border-strong',  var: '--color-border-strong',  hex: '#484f58' },
  { name: 'ink',            var: '--color-ink',            hex: '#e6edf3' },
  { name: 'ink-muted',      var: '--color-ink-muted',      hex: '#8b949e' },
  { name: 'ink-faint',      var: '--color-ink-faint',      hex: '#484f58' },
  { name: 'critical',       var: '--color-critical',       hex: '#f85149' },
  { name: 'warning',        var: '--color-warning',        hex: '#d29922' },
  { name: 'info',           var: '--color-info',           hex: '#58a6ff' },
  { name: 'success',        var: '--color-success',        hex: '#3fb950' },
  { name: 'won',            var: '--color-won',            hex: '#a371f7' },
  { name: 'idle',           var: '--color-idle',           hex: '#6e7681' },
]

const PILL_VARIANTS: { group: string; items: { v: PillVariant; label?: string }[] }[] = [
  {
    group: 'Lead stages',
    items: [
      { v: 'new' }, { v: 'contacted' }, { v: 'inspection' },
      { v: 'quote_sent' }, { v: 'won' }, { v: 'deferred' }, { v: 'lost' },
    ],
  },
  {
    group: 'Health / relationship',
    items: [
      { v: 'active' }, { v: 'on-track' }, { v: 'warning' },
      { v: 'critical' }, { v: 'at_risk' }, { v: 'winding_down' }, { v: 'idle' },
    ],
  },
  {
    group: 'Commission model',
    items: [
      { v: 'percentage' }, { v: 'flat_fee' }, { v: 'retainer' },
    ],
  },
]

const DEMO_SPARKLINE = [42, 58, 51, 67, 74, 61, 80, 95]
const STAT_CARDS = [
  {
    label: 'Leads deze week',
    value: 127,
    delta: 12.3,
    deltaLabel: 'vs vorige week',
    previousValue: 113,
    sparkline: DEMO_SPARKLINE,
  },
  {
    label: 'Kwalificatieratio',
    value: 68,
    suffix: '%',
    delta: -4.1,
    deltaLabel: 'vs vorige maand',
    previousValue: 71,
    sparkline: [71, 69, 72, 70, 65, 64, 68],
  },
  {
    label: 'Open offerte waarde',
    value: 24750,
    prefix: '€',
    subtext: '13 offertes open',
  },
  {
    label: 'Commissie MTD',
    value: 8200,
    prefix: '€',
    delta: 18.5,
    deltaLabel: 'vs vorige maand',
    previousValue: 6930,
    sparkline: [3100, 4800, 5200, 6100, 7400, 8200],
    sparkColor: 'var(--color-success)',
  },
  {
    label: 'Retainer MTD',
    value: null,
    subtext: 'Tarief niet ingesteld',
  },
  {
    label: 'Backlog debt',
    value: 6,
    suffix: ' leads',
    subtext: '>30d geen activiteit',
  },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{
        fontSize:     'var(--font-size-xs)',
        fontWeight:   600,
        color:        'var(--color-ink-faint)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 16,
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function PreviewPage() {
  return (
    <div style={{
      maxWidth:  960,
      margin:    '0 auto',
      padding:   '48px 32px',
      minHeight: '100vh',
    }}>
      <h1 style={{
        fontSize:     'var(--font-size-xl)',
        fontWeight:   600,
        color:        'var(--color-ink)',
        marginBottom: 8,
      }}>
        Design System — Preview
      </h1>
      <p style={{
        fontSize:     'var(--font-size-sm)',
        color:        'var(--color-ink-muted)',
        marginBottom: 48,
      }}>
        Phase 4A primitives — design tokens, StatusPill, StatCard
      </p>

      {/* ── Color palette ── */}
      <Section title="Color tokens">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SWATCH_DATA.map(s => (
            <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 100 }}>
              <div style={{
                height:       36,
                borderRadius: 'var(--radius-md)',
                background:   `var(${s.var})`,
                border:       '1px solid var(--color-border)',
              }} />
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink)', fontWeight: 500 }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.hex}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── StatusPill ── */}
      <Section title="StatusPill">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {PILL_VARIANTS.map(group => (
            <div key={group.group}>
              <div style={{
                fontSize:     'var(--font-size-xs)',
                color:        'var(--color-ink-muted)',
                marginBottom: 10,
              }}>
                {group.group}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {group.items.map(({ v, label }) => (
                  <div key={v} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <StatusPill variant={v} label={label} size="sm" />
                    <StatusPill variant={v} label={label} size="xs" dot={false} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Sparkline ── */}
      <Section title="Sparkline">
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', marginBottom: 8 }}>
              Default (64×24)
            </div>
            <Sparkline data={DEMO_SPARKLINE} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', marginBottom: 8 }}>
              Success color (96×28)
            </div>
            <Sparkline data={DEMO_SPARKLINE} width={96} height={28} color="var(--color-success)" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', marginBottom: 8 }}>
              Critical color (96×28)
            </div>
            <Sparkline data={[95, 80, 61, 74, 67, 51, 58, 42]} width={96} height={28} color="var(--color-critical)" />
          </div>
        </div>
      </Section>

      {/* ── StatCard ── */}
      <Section title="StatCard">
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap:                 12,
          marginBottom:        16,
        }}>
          {STAT_CARDS.map((card, i) => (
            <StatCard key={i} {...card} />
          ))}
        </div>
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap:                 12,
        }}>
          <StatCard label="Kleine kaart" value={42} size="sm" delta={5.2} />
          <StatCard label="Grote kaart" value={1234567} prefix="€" size="lg" delta={-2.1} deltaLabel="MoM" />
          <StatCard label="Null state" value={null} subtext="Geen data beschikbaar" />
          <StatCard label="Alleen waarde" value="14 dagen" />
        </div>
      </Section>
    </div>
  )
}
