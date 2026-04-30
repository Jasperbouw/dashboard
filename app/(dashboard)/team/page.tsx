export const revalidate = false

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize:      'var(--font-size-xs)',
      fontWeight:    600,
      color:         'var(--color-ink-faint)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      margin:        '0 0 16px',
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
      padding:      '24px',
      ...style,
    }}>
      {children}
    </div>
  )
}

type OwnershipSection = { heading: string; items: string[] }

function PersonCard({
  name, role, color, focus, sections,
}: {
  name:     string
  role:     string
  color:    string
  focus:    string[]
  sections: OwnershipSection[]
}) {
  return (
    <Card>
      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: color, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--font-size-sm)', fontWeight: 700, color: '#fff',
        }}>
          {name[0]}
        </div>
        <div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-ink)' }}>{name}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color, fontWeight: 500, marginTop: 2 }}>{role}</div>
        </div>
      </div>

      {/* Focus tags */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 'var(--font-size-2xs)', fontWeight: 600,
          color: 'var(--color-ink-faint)', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 8,
        }}>
          Focus
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {focus.map(f => (
            <span key={f} style={{
              fontSize: 'var(--font-size-xs)', padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              background: `${color}18`, color, border: `1px solid ${color}44`,
            }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Eigenaarschap */}
      <div>
        <div style={{
          fontSize: 'var(--font-size-2xs)', fontWeight: 600,
          color: 'var(--color-ink-faint)', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 14,
        }}>
          Eigenaarschap
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map((s, i) => (
            <div key={i}>
              <div style={{
                fontSize: 'var(--font-size-xs)', fontWeight: 600,
                color: 'var(--color-ink)', marginBottom: 6,
              }}>
                {s.heading}
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {s.items.map((item, j) => (
                  <li key={j} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

const JASPER_SECTIONS: OwnershipSection[] = [
  {
    heading: 'Creatives Productie',
    items: [
      'Video en static ads produceren',
      'Copy schrijven',
      'Wekelijkse output (totdat outsourced)',
    ],
  },
  {
    heading: 'Operations & Infrastructure',
    items: [
      'Command Center dashboard onderhoud',
      'Zapier automations',
      'Monday.com setup',
      'Lead routing en distributie logica',
      'Data integriteit',
      'Tools (Leadbyte, Stripe integraties, etc.)',
    ],
  },
  {
    heading: 'Acquisition & Account Management',
    items: [
      'Discovery calls en demo\'s (vanaf tweede meeting alleen)',
      'Contract onderhandeling en versturen',
      'Onboarding van nieuwe contractors',
      'Wekelijkse/maandelijkse check-ins met klanten',
      'Performance gesprekken op basis van dashboard data',
      'Contract verlengingen en uitbreidingen',
    ],
  },
  {
    heading: 'Strategy',
    items: [
      'Pricing strategy',
      'Tool en infrastructure investeringen',
    ],
  },
]

const PHILIP_SECTIONS: OwnershipSection[] = [
  {
    heading: 'Sales & Lead Conversion',
    items: [
      'Alle inbound leads bellen (eerste contact)',
      'Lead kwalificatie volgens overeengekomen criteria',
      'Lead nurturing en opvolg-calls',
      'Inspectie afspraken regelen waar van toepassing',
      'Lead-niveau communicatie met eindklanten',
      'Status updates terugkoppelen naar contractors',
    ],
  },
  {
    heading: 'Finance & Admin',
    items: [
      'Klantfacturatie (ad budgets, retainer fees, commissies)',
      'Profit sheet bijhouden (Google Sheets / Command Center)',
      'Cashflow tracking en planning',
      'Interface met externe boekhouder',
      'Stripe abonnementen monitoren (Leadbyte klanten)',
    ],
  },
]

const RITUALS = [
  {
    freq: 'Wekelijks',
    items: [
      'Leads doorlopen — kwaliteit, opvolging, bottlenecks',
      'Campagneprestaties reviewen — CTR, CPL, budget',
      'Open commissies checken — wat staat er nog open?',
      'Volgende week plannen — prioriteiten afstemmen',
    ],
  },
  {
    freq: 'Maandelijks',
    items: [
      'Finance afsluiten — omzet, ad budget, P&L',
      'Contractor check-in — health, tevredenheid, groei',
      'Funnel analyse — conversie per niche en campagne',
      'Retrospective — wat werkt, wat niet, wat veranderen?',
    ],
  },
  {
    freq: 'Kwartaal',
    items: [
      'Strategische review — doelen, groei, focus niches',
      'Contractor portfolio — uitbreiden, afbouwen, herprijzen',
      'Tariefstructuur evalueren — modellen, marges, contracten',
      'Doelen Q+1 vaststellen',
    ],
  },
]

export default function TeamPage() {
  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{
          fontSize:   'var(--font-size-2xl)',
          fontWeight: 600,
          color:      'var(--color-ink)',
          margin:     0,
        }}>
          Team
        </h1>
        <p style={{
          fontSize:  'var(--font-size-sm)',
          color:     'var(--color-ink-muted)',
          marginTop: 4,
        }}>
          Rollen, eigenaarschap en operationele rituelen
        </p>
      </div>

      {/* People */}
      <div style={{ marginBottom: 12 }}>
        <SectionTitle>Wie doet wat</SectionTitle>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32, alignItems: 'start' }}>
        <PersonCard
          name="Jasper"
          role="Build & Grow"
          color="#4f7df3"
          focus={['Build', 'Operations', 'Acquisition', 'Strategy']}
          sections={JASPER_SECTIONS}
        />
        <PersonCard
          name="Philip"
          role="Connect & Convert"
          color="#10b981"
          focus={['Sales', 'Lead conversion', 'Finance', 'Admin']}
          sections={PHILIP_SECTIONS}
        />
      </div>

      {/* Samen */}
      <div style={{ marginBottom: 12 }}>
        <SectionTitle>Samen</SectionTitle>
      </div>
      <Card style={{ marginBottom: 32 }}>
        {/* Marketing & Lead Generation — joint ownership */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 600,
            color: 'var(--color-ink)', marginBottom: 8,
          }}>
            Marketing & Lead Generation
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              'Meta Ads campagnes opzetten, beheren en optimaliseren',
              'Targeting, audiences, creatives strategy',
              'Budget allocatie',
              'Performance monitoring en A/B testing',
              'CPL benchmarks bewaken per niche',
            ].map(item => (
              <li key={item} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>{item}</li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            {
              label: 'Gedeeld eigenaarschap',
              items: ['Niche beslissingen', 'Prijsstrategie en marges', 'Welke niches te groeien', 'Contractuele afspraken', 'Grote beslissingen'],
            },
            {
              label: 'Communicatie',
              items: ['Wekelijkse sync (vast moment)', 'Alles wat de ander raakt direct delen', 'Geen verrassingen in finance of pipeline'],
            },
            {
              label: 'Kernprincipes',
              items: ['Kwaliteit boven volume', 'Contractors zijn partners', 'Meten > aanvoelen', 'Simpel houden zolang het kan'],
            },
          ].map(col => (
            <div key={col.label}>
              <div style={{
                fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                color: 'var(--color-ink-faint)', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginBottom: 10,
              }}>
                {col.label}
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {col.items.map(item => (
                  <li key={item} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)' }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Rituelen */}
      <div style={{ marginBottom: 12 }}>
        <SectionTitle>Operationele rituelen</SectionTitle>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {RITUALS.map(r => (
          <Card key={r.freq}>
            <div style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 600,
              color: 'var(--color-accent)', marginBottom: 14,
            }}>
              {r.freq}
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.items.map(item => (
                <li key={item} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

    </div>
  )
}
