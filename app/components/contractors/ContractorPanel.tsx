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

// ── Financieel tab ────────────────────────────────────────────────────────────

interface FinanceData {
  commission_model:     string | null
  retainer_billing:     string | null
  monthly_retainer_fee: number | null
  monthly_ad_budget:    number | null
  relationship_status:  string | null
  commissionMTD:        number
  commissionQTD:        number
  commissionYTD:        number
  commissionPending:    number
  pendingCount:         number
  retainerFeeMTD:       number | null
  retainerFeeYTD:       number | null
  recent: {
    project_name:     string | null
    aanneemsom:       number | null
    commissie:        number | null
    commissie_status: string | null
    date:             string | null
  }[]
}

function StatTile({
  label, value, sub, highlight, tooltip,
}: { label: string; value: string; sub?: string; highlight?: boolean; tooltip?: string }) {
  return (
    <div title={tooltip} style={{
      padding: '12px 14px',
      background: 'var(--color-surface-raised)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{
        fontSize: 'var(--font-size-2xs)', fontWeight: 600,
        color: 'var(--color-ink-faint)', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--font-size-lg)', fontWeight: 600,
        color: highlight ? 'var(--color-success)' : 'var(--color-ink)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isPaid(status: string | null) {
  return !!status?.toLowerCase().includes('betaald')
}

function FinancieelTab({ contractorId }: { contractorId: string }) {
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/contractors/${contractorId}/finance`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [contractorId])

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
      Laden…
    </div>
  )
  if (error || !data) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-critical)', fontSize: 'var(--font-size-sm)' }}>
      Fout bij laden: {error ?? 'onbekend'}
    </div>
  )

  const isRetainer = data.commission_model === 'retainer'

  const sectionTitle = (label: string) => (
    <div style={{
      fontSize: 'var(--font-size-xs)', fontWeight: 600,
      color: 'var(--color-ink-faint)', textTransform: 'uppercase',
      letterSpacing: '0.06em', marginBottom: 12,
    }}>
      {label}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Commission cards — adapts per model */}
      <div>
        {sectionTitle(isRetainer ? 'Retainer overzicht' : 'Commissie overzicht')}
        {isRetainer ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <StatTile
              label="Retainer fee / maand"
              value={fmtEur(data.monthly_retainer_fee)}
              sub="onze commissie"
              highlight={(data.monthly_retainer_fee ?? 0) > 0}
            />
            <StatTile
              label="Ad budget / maand"
              value={fmtEur(data.monthly_ad_budget)}
              sub="wordt direct naar Meta doorbelast"
            />
            <StatTile
              label="Gefactureerd YTD"
              value={fmtEur(data.retainerFeeYTD)}
              sub="fee only — excl. ad budget"
              highlight={(data.retainerFeeYTD ?? 0) > 0}
              tooltip="Alleen onze fee × maanden YTD. Ad budget is pass-through en telt niet mee als omzet."
            />
            <StatTile
              label="Relatiestatus"
              value={
                data.relationship_status === 'at_risk'      ? 'At risk' :
                data.relationship_status === 'winding_down' ? 'Aflopend' :
                'Actief'
              }
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <StatTile label="MTD" value={fmtEur(data.commissionMTD)} highlight={data.commissionMTD > 0}
              tooltip="Uitbetaalde commissies deze kalendermaand (cash-basis)." />
            <StatTile label="QTD" value={fmtEur(data.commissionQTD)} highlight={data.commissionQTD > 0}
              tooltip="Uitbetaalde commissies dit kwartaal (cash-basis)." />
            <StatTile label="YTD" value={fmtEur(data.commissionYTD)} highlight={data.commissionYTD > 0}
              tooltip="Alleen uitbetaalde commissies dit jaar. Zie Pending voor verdiend maar nog niet uitbetaald." />
            <StatTile
              label="Pending"
              value={fmtEur(data.commissionPending)}
              sub={data.pendingCount > 0 ? `${data.pendingCount} open ${data.pendingCount === 1 ? 'project' : 'projecten'}` : undefined}
              tooltip="Verdiende commissie op gewonnen projecten — nog niet uitbetaald door contractor." />
          </div>
        )}
      </div>

      {/* Recent entries table */}
      <div>
        {sectionTitle('Recente projecten')}
        {data.recent.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center',
            color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)',
            background: 'var(--color-surface-raised)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)',
          }}>
            Geen projecten gevonden
          </div>
        ) : (
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Project', 'Aanneemsom', 'Commissie', 'Status', 'Datum'].map(h => (
                    <th key={h} style={{
                      padding: '7px 10px', fontSize: 'var(--font-size-2xs)',
                      fontWeight: 600, color: 'var(--color-ink-faint)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      textAlign: h === 'Project' ? 'left' : 'right',
                      borderBottom: '1px solid var(--color-border)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent.map((p, i) => {
                  const paid = isPaid(p.commissie_status)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{
                        padding: '8px 10px', fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-ink)', maxWidth: 140,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.project_name || '—'}
                      </td>
                      <td style={{
                        padding: '8px 10px', fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-ink-muted)', textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                      }}>
                        {fmtEur(p.aanneemsom)}
                      </td>
                      <td style={{
                        padding: '8px 10px', fontSize: 'var(--font-size-xs)',
                        color: (p.commissie ?? 0) > 0 ? 'var(--color-success)' : 'var(--color-ink-faint)',
                        textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                      }}>
                        {fmtEur(p.commissie)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                          color: paid ? 'var(--color-success)' : 'var(--color-ink-faint)',
                          background: paid ? 'var(--color-success-subtle)' : 'var(--color-surface-raised)',
                          borderRadius: 'var(--radius-full)', padding: '1px 6px',
                        }}>
                          {p.commissie_status ?? '—'}
                        </span>
                      </td>
                      <td style={{
                        padding: '8px 10px', fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-ink-faint)', textAlign: 'right', whiteSpace: 'nowrap',
                      }}>
                        {fmtDate(p.date)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

// ── Offertes & Deals tab ─────────────────────────────────────────────────────

interface OffertesData {
  service_model: string | null
  is_hands_off:  boolean
  openQuotes: {
    id:             string
    contact_name:   string | null
    quote_amount:   number | null
    age_days:       number
    monday_url:     string
    current_status: string | null
  }[]
  wonProjects: {
    project_name:     string | null
    aanneemsom:       number | null
    commissie:        number | null
    commissie_status: string | null
    date:             string | null
  }[]
  lostLeads: {
    contact_name: string | null
    reason:       string | null
    date:         string | null
    monday_url:   string
  }[]
}

function ageColor(days: number): string {
  if (days > 30) return 'var(--color-critical)'
  if (days > 14) return 'var(--color-warning)'
  return 'var(--color-ink-muted)'
}

function OffertesTab({ contractorId }: { contractorId: string }) {
  const [data, setData] = useState<OffertesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLost, setShowLost] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/contractors/${contractorId}/offertes`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [contractorId])

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
      Laden…
    </div>
  )
  if (error || !data) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-critical)', fontSize: 'var(--font-size-sm)' }}>
      Fout bij laden: {error ?? 'onbekend'}
    </div>
  )

  if (data.is_hands_off) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 160, borderRadius: 'var(--radius-lg)',
      background: 'var(--color-surface-raised)',
      border: '1px dashed var(--color-border)',
      fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-faint)',
    }}>
      Offertes n.v.t. voor passieve / retainer klanten
    </div>
  )

  const sectionTitle = (label: string, count?: number) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
    }}>
      <span style={{
        fontSize: 'var(--font-size-xs)', fontWeight: 600,
        color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </span>
      {count != null && count > 0 && (
        <span style={{
          fontSize: 'var(--font-size-2xs)', fontWeight: 600,
          color: 'var(--color-ink-muted)',
          background: 'var(--color-surface-raised)',
          borderRadius: 'var(--radius-full)', padding: '0 6px',
          border: '1px solid var(--color-border-subtle)',
        }}>
          {count}
        </span>
      )}
    </div>
  )

  const tableWrap: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  }
  const thStyle: React.CSSProperties = {
    padding: '7px 10px', fontSize: 'var(--font-size-2xs)', fontWeight: 600,
    color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em',
    textAlign: 'left', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: 'var(--font-size-xs)',
    color: 'var(--color-ink)', borderBottom: '1px solid var(--color-border-subtle)',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Open quotes */}
      <div>
        {sectionTitle('Open offertes', data.openQuotes.length)}
        {data.openQuotes.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center',
            color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)',
            background: 'var(--color-surface-raised)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)',
          }}>
            Geen open offertes
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Contact</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Aanneemsom</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Leeftijd</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Link</th>
                </tr>
              </thead>
              <tbody>
                {data.openQuotes.map(q => (
                  <tr key={q.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{q.contact_name || '—'}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtEur(q.quote_amount)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: ageColor(q.age_days), fontWeight: q.age_days > 14 ? 600 : 400 }}>
                      {q.age_days === 0 ? 'Vandaag' : `${q.age_days}d`}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <a
                        href={q.monday_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-info)',
                          textDecoration: 'none',
                        }}
                      >
                        ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Won projects */}
      <div>
        {sectionTitle('Recent gesloten', data.wonProjects.length)}
        {data.wonProjects.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center',
            color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)',
            background: 'var(--color-surface-raised)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)',
          }}>
            Geen gesloten deals
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Project</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Aanneemsom</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Commissie</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Datum</th>
                </tr>
              </thead>
              <tbody>
                {data.wonProjects.map((p, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.project_name || '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtEur(p.aanneemsom)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      color: (p.commissie ?? 0) > 0 ? 'var(--color-success)' : 'var(--color-ink-faint)' }}>
                      {fmtEur(p.commissie)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-ink-faint)' }}>
                      {fmtDate(p.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lost deals — collapsible */}
      {data.lostLeads.length > 0 && (
        <div>
          <button
            onClick={() => setShowLost(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: showLost ? 12 : 0,
            }}
          >
            <span style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 600,
              color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {showLost ? '▾' : '▸'} Verloren ({data.lostLeads.length})
            </span>
          </button>
          {showLost && (
            <div style={tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Contact</th>
                    <th style={thStyle}>Reden</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Datum</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lostLeads.map((l, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{l.contact_name || '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--color-ink-muted)', maxWidth: 160,
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.reason || '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-ink-faint)' }}>
                        {fmtDate(l.date)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <a href={l.monday_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-info)', textDecoration: 'none' }}>
                          ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
              {tab === 'financieel'  && <FinancieelTab contractorId={contractor.id} />}
              {tab === 'offertes'    && <OffertesTab contractorId={contractor.id} />}
              {tab === 'info'        && <ComingSoon label="Info & Documenten" />}
              {tab === 'locatie'     && <ComingSoon label="Locatie & Werkgebied" />}
            </div>
          </>
        )}
      </div>
    </>
  )
}
