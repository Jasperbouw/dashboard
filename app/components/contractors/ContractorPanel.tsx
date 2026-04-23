'use client'

import { useEffect, useState } from 'react'
import type { ContractorSummary } from '../../../lib/metrics'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(v: number | null | undefined) {
  if (v == null || v === 0) return '—'
  return `€${v.toLocaleString('nl-NL')}`
}
function fmtPct(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v}%`
}
function Dash() {
  return <span style={{ color: 'var(--color-ink-faint)' }}>—</span>
}

const STAGE_LABELS: Record<string, string> = {
  new:        'Nieuw',
  contacted:  'Gecontacteerd',
  inspection: 'Inspectie',
  quote_sent: 'Offerte',
  won:        'Gewonnen',
  lost:       'Verloren',
  deferred:   'Uitgesteld',
}

const STAGE_COLOR: Record<string, string> = {
  new:        'var(--color-info)',
  contacted:  'var(--color-quote)',
  inspection: 'var(--color-info-muted, var(--color-quote))',
  quote_sent: 'var(--color-warning)',
  won:        'var(--color-success)',
  lost:       'var(--color-critical)',
  deferred:   'var(--color-ink-faint)',
}

const MODEL_LABEL: Record<string, string> = {
  percentage: 'Percentage', flat_fee: 'Flat fee', retainer: 'Retainer',
}
const SERVICE_LABEL: Record<string, string> = {
  full_sales: 'Full sales', leads_only: 'Leads only', hands_off: 'Passief',
}
const QUAL_LABEL: Record<string, string> = {
  pre_qualified: 'Pre-qualified', unfiltered: 'Unfiltered',
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'performance' | 'financieel' | 'offertes' | 'info' | 'locatie'

const TABS: { id: Tab; label: string }[] = [
  { id: 'performance', label: 'Performance' },
  { id: 'financieel',  label: 'Financieel'  },
  { id: 'offertes',    label: 'Offertes'    },
  { id: 'info',        label: 'Info'        },
  { id: 'locatie',     label: 'Locatie'     },
]

// ── Performance tab ───────────────────────────────────────────────────────────

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{
      height: 4, borderRadius: 2,
      background: 'var(--color-surface-raised)',
      overflow: 'hidden', flex: 1,
    }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: color, borderRadius: 2,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

function PerformanceTab({ c }: { c: ContractorSummary }) {
  const { periodStages, snapshotStages } = c

  // Period funnel: new→contacted→quote_sent→won, showing progression %s
  const funnelSteps = [
    { key: 'new',        label: 'Nieuw',         count: periodStages.new        },
    { key: 'contacted',  label: 'Gecontacteerd', count: periodStages.contacted  },
    { key: 'inspection', label: 'Inspectie',     count: periodStages.inspection },
    { key: 'quote_sent', label: 'Offerte',       count: periodStages.quote_sent },
    { key: 'won',        label: 'Gewonnen',      count: periodStages.won        },
  ]
  const topCount = c.leadsReceived || 1

  // Snapshot: current open pipeline
  const openCount = snapshotStages.new + snapshotStages.contacted + snapshotStages.quote_sent

  const metricStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 2,
    padding: '12px 14px',
    background: 'var(--color-surface-raised)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-subtle)',
  }
  const metricLabelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-2xs)', fontWeight: 600,
    color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em',
  }
  const metricValueStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-lg)', fontWeight: 600,
    color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Key metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <div style={metricStyle}>
          <span style={metricLabelStyle}>Leads (30d)</span>
          <span style={metricValueStyle}>{c.leadsReceived || <Dash />}</span>
        </div>
        <div style={metricStyle}>
          <span style={metricLabelStyle}>Qual%</span>
          <span style={metricValueStyle}>{fmtPct(c.qualificationRate)}</span>
        </div>
        <div style={metricStyle}>
          <span style={metricLabelStyle}>Close%</span>
          <span style={metricValueStyle}>{fmtPct(c.closeRate)}</span>
        </div>
      </div>

      {/* Period funnel */}
      <div>
        <div style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 600,
          color: 'var(--color-ink-faint)', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 12,
        }}>
          Instroom afgelopen 30 dagen
        </div>
        {c.leadsReceived === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center',
            color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)',
            background: 'var(--color-surface-raised)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)',
          }}>
            Geen leads in deze periode
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnelSteps.map((step, i) => {
              const prevCount = i === 0 ? topCount : funnelSteps[i - 1].count
              const convPct = prevCount > 0 ? Math.round(step.count / prevCount * 100) : 0
              return (
                <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 90, fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-ink-muted)', flexShrink: 0,
                  }}>
                    {step.label}
                  </span>
                  <MiniBar value={step.count} max={topCount} color={STAGE_COLOR[step.key]} />
                  <span style={{
                    width: 28, textAlign: 'right',
                    fontSize: 'var(--font-size-sm)', fontWeight: 500,
                    color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                  }}>
                    {step.count}
                  </span>
                  {i > 0 && (
                    <span style={{
                      width: 36, textAlign: 'right',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-ink-faint)', flexShrink: 0,
                    }}>
                      {convPct}%
                    </span>
                  )}
                </div>
              )
            })}
            {/* Lost/deferred row */}
            {(periodStages.lost > 0 || periodStages.deferred > 0) && (
              <div style={{
                marginTop: 4, paddingTop: 8,
                borderTop: '1px solid var(--color-border-subtle)',
                display: 'flex', gap: 16,
                fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)',
              }}>
                {periodStages.lost > 0 && (
                  <span>{periodStages.lost} verloren</span>
                )}
                {periodStages.deferred > 0 && (
                  <span>{periodStages.deferred} uitgesteld</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Snapshot: open pipeline */}
      <div>
        <div style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 600,
          color: 'var(--color-ink-faint)', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 12,
        }}>
          Huidige pipeline (snapshot)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {(['new', 'contacted', 'inspection', 'quote_sent'] as const).map(stage => (
            <div key={stage} style={{
              padding: '10px 12px',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{
                fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)',
                marginBottom: 4,
              }}>
                {STAGE_LABELS[stage]}
              </div>
              <div style={{
                fontSize: 'var(--font-size-md)', fontWeight: 600,
                color: snapshotStages[stage] > 0 ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {snapshotStages[stage] || '—'}
              </div>
            </div>
          ))}
          <div style={{
            padding: '10px 12px',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginBottom: 4 }}>
              Backlog
            </div>
            <div style={{
              fontSize: 'var(--font-size-md)', fontWeight: 600,
              color: c.backlogDebt > 0 ? 'var(--color-warning)' : 'var(--color-ink-faint)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {c.backlogDebt || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Doorlooptijden — placeholder until lead_status_changes has data */}
      <div>
        <div style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 600,
          color: 'var(--color-ink-faint)', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 12,
        }}>
          Doorlooptijden
        </div>
        <div style={{
          padding: '14px 16px',
          background: 'var(--color-surface-raised)',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-ink-faint)',
        }}>
          Gemiddelden beschikbaar zodra statushistorie is opgebouwd (lead_status_changes).
        </div>
      </div>

    </div>
  )
}

// ── Coming soon placeholder ───────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 200,
      background: 'var(--color-surface-raised)',
      border: '1px dashed var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      fontSize: 'var(--font-size-sm)',
      color: 'var(--color-ink-faint)',
    }}>
      {label} — binnenkort beschikbaar
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  contractor: ContractorSummary | null
  onClose: () => void
}

const PANEL_WIDTH = 560

export function ContractorPanel({ contractor, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('performance')
  const [mounted, setMounted] = useState(false)

  // Reset tab when switching contractors
  useEffect(() => {
    if (contractor) {
      setTab('performance')
      // Defer mount flag one frame so CSS transition fires
      const id = requestAnimationFrame(() => setMounted(true))
      return () => cancelAnimationFrame(id)
    } else {
      setMounted(false)
    }
  }, [contractor?.id])

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const visible = contractor != null && mounted

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.25)',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
          zIndex: 40,
        }}
      />

      {/* Drawer */}
      <div style={{
        position:   'fixed',
        top:        0,
        right:      0,
        bottom:     0,
        width:      PANEL_WIDTH,
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        display:    'flex',
        flexDirection: 'column',
        transform:  visible ? 'translateX(0)' : `translateX(${PANEL_WIDTH}px)`,
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        zIndex:     50,
        overflow:   'hidden',
      }}>
        {contractor && (
          <>
            {/* Header */}
            <div style={{
              padding:      '18px 20px 0',
              borderBottom: '1px solid var(--color-border)',
              flexShrink:   0,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h2 style={{
                      fontSize: 'var(--font-size-lg)', fontWeight: 600,
                      color: 'var(--color-ink)', margin: 0,
                    }}>
                      {contractor.name}
                    </h2>
                    <span style={{
                      fontSize: 'var(--font-size-2xs)', fontWeight: 500,
                      color: 'var(--color-ink-muted)',
                      background: 'var(--color-surface-raised)',
                      borderRadius: 'var(--radius-full)', padding: '1px 7px',
                      border: '1px solid var(--color-border-subtle)',
                    }}>
                      {contractor.niche}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {contractor.commission_model && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                        {MODEL_LABEL[contractor.commission_model] ?? contractor.commission_model}
                      </span>
                    )}
                    {contractor.service_model && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                        · {SERVICE_LABEL[contractor.service_model] ?? contractor.service_model}
                      </span>
                    )}
                    {contractor.qualification_model && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                        · {QUAL_LABEL[contractor.qualification_model] ?? contractor.qualification_model}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-ink-faint)', fontSize: 18, lineHeight: 1,
                    padding: '2px 4px', borderRadius: 'var(--radius-sm)',
                  }}
                  aria-label="Sluiten"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0 }}>
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      padding: '8px 14px',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: tab === t.id ? 500 : 400,
                      color: tab === t.id ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      borderBottom: tab === t.id ? '2px solid var(--color-ink)' : '2px solid transparent',
                      marginBottom: -1,
                      transition: 'color 0.1s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {tab === 'performance' && <PerformanceTab c={contractor} />}
              {tab === 'financieel'  && <ComingSoon label="Financieel" />}
              {tab === 'offertes'    && <ComingSoon label="Offertes & Deals" />}
              {tab === 'info'        && <ComingSoon label="Info & Documenten" />}
              {tab === 'locatie'     && <ComingSoon label="Locatie & Werkgebied" />}
            </div>
          </>
        )}
      </div>
    </>
  )
}
