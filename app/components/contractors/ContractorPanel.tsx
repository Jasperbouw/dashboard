'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import type { ContractorSummary } from '../../../lib/metrics'
import { supabase } from '../../../lib/supabase'
import { LocatieTab } from './LocatieTab'
import { PakkettanTab } from './PakkettanTab'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 30_000 } as const

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

type Tab = 'performance' | 'financieel' | 'pakketten' | 'offertes' | 'info' | 'locatie'

const TABS: { id: Tab; label: string }[] = [
  { id: 'performance', label: 'Performance' },
  { id: 'financieel',  label: 'Financieel'  },
  { id: 'pakketten',   label: 'Pakketten'   },
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
  retainerFeeQTD:       number | null
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

const ENTRY_TYPE_LABELS: Record<string, string> = {
  ad_budget:             'Ad budget (pass-through)',
  retainer_fee:          'Retainerfee',
  commission_percentage: 'Commissie (percentage)',
  commission_flat:       'Commissie (vast bedrag)',
  other:                 'Overig',
}
const ENTRY_NICHES = ['bouw', 'daken', 'dakkapel', 'extras', 'zwembad', 'nieuwbouw', 'pergola']

interface EntryForm {
  type:             string
  entry_date:       string
  period_start:     string
  period_end:       string
  niche:            string
  amount:           string
  ad_budget_amount: string
  description:      string
  invoice_number:   string
  payment_status:   string
  notes:            string
}

function emptyForm(defaultType = ''): EntryForm {
  const today = new Date().toISOString().slice(0, 10)
  return {
    type: defaultType, entry_date: today, period_start: '', period_end: '',
    niche: '', amount: '', ad_budget_amount: '0', description: '',
    invoice_number: '', payment_status: 'paid', notes: '',
  }
}

function RevenueEntryModal({
  contractorId,
  defaultType,
  onClose,
  onSaved,
}: {
  contractorId: string
  defaultType?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<EntryForm>(emptyForm(defaultType))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function set(field: keyof EntryForm, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-fill ad_budget_amount when type = ad_budget
      if (field === 'type' && value === 'ad_budget') next.ad_budget_amount = next.amount
      if (field === 'amount' && prev.type === 'ad_budget') next.ad_budget_amount = value
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.entry_date || !form.type) { setErr('Datum, type en bedrag zijn verplicht'); return }
    setSaving(true)
    setErr(null)
    const res = await fetch(`/api/contractors/${contractorId}/revenue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setErr(j.error ?? 'Opslaan mislukt'); return }
    onSaved()
    onClose()
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-ink-faint)',
    display: 'block', marginBottom: 4,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-sm)', padding: '7px 10px',
    fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', fontFamily: 'inherit',
  }
  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 24, width: 480,
          maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', color: 'var(--color-ink)' }}>
            Nieuwe revenue entry
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-ink-faint)', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle} required>
                <option value="">— kies type —</option>
                {Object.entries(ENTRY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Datum *</label>
              <input type="date" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} style={inputStyle} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Bedrag (€) *</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} style={inputStyle} required placeholder="0.00" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Niche</label>
              <select value={form.niche} onChange={e => set('niche', e.target.value)} style={inputStyle}>
                <option value="">— optioneel —</option>
                {ENTRY_NICHES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Ad budget deel (€)</label>
              <input type="number" step="0.01" min="0" value={form.ad_budget_amount} onChange={e => set('ad_budget_amount', e.target.value)} style={inputStyle} placeholder="0" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Betaalstatus</label>
              <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)} style={inputStyle}>
                <option value="paid">Betaald</option>
                <option value="open">Open</option>
                <option value="overdue">Te laat</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Periode van</label>
              <input type="date" value={form.period_start} onChange={e => set('period_start', e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Periode t/m</label>
              <input type="date" value={form.period_end} onChange={e => set('period_end', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Omschrijving</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)} style={inputStyle} placeholder="Bijv. 'April factuur — Hollands Prefab bouw'" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Factuurnummer</label>
              <input type="text" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} style={inputStyle} placeholder="2026-042" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Notities</label>
              <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={inputStyle} placeholder="Intern" />
            </div>
          </div>

          {err && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)', padding: '6px 10px', background: 'var(--color-critical-subtle)', borderRadius: 'var(--radius-sm)' }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', padding: '8px 16px' }}>
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 20px', background: 'var(--color-accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontSize: 'var(--font-size-sm)', fontWeight: 500, opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Bezig…' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FinancieelTab({ contractorId }: { contractorId: string }) {
  const { data, error, isLoading, mutate } = useSWR<FinanceData>(
    `/api/contractors/${contractorId}/finance`, fetcher, SWR_OPTS,
  )
  const [modalOpen, setModalOpen] = useState(false)

  if (isLoading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
      Laden…
    </div>
  )
  if (error || !data) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-critical)', fontSize: 'var(--font-size-sm)' }}>
      Fout bij laden: {error?.message ?? 'onbekend'}
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
    <>
    {modalOpen && (
      <RevenueEntryModal
        contractorId={contractorId}
        defaultType={isRetainer ? 'retainer_fee' : 'commission_percentage'}
        onClose={() => setModalOpen(false)}
        onSaved={() => mutate()}
      />
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Commission cards — adapts per model */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {isRetainer ? 'Retainer overzicht' : 'Commissie overzicht'}
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '3px 10px',
              background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)',
            }}
          >
            + Nieuwe entry
          </button>
        </div>
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
              tooltip="Som van verstuurde facturen dit jaar (fee only). Ad budget is pass-through en telt niet mee als omzet."
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
    </>
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
  const { data, error, isLoading } = useSWR<OffertesData>(
    `/api/contractors/${contractorId}/offertes`, fetcher, SWR_OPTS,
  )
  const [showLost, setShowLost] = useState(false)

  if (isLoading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
      Laden…
    </div>
  )
  if (error || !data) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-critical)', fontSize: 'var(--font-size-sm)' }}>
      Fout bij laden: {error?.message ?? 'onbekend'}
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

// ── Info & Documenten tab ─────────────────────────────────────────────────────

function CollapsibleSection({
  title, defaultOpen = true, children, action,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  action?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: open ? 16 : 0 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', cursor: 'pointer', padding: '14px 0', gap: 8,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {action}
          <span style={{ fontSize: 10, color: 'var(--color-ink-faint)', transform: open ? 'rotate(180deg)' : undefined, display: 'inline-block', transition: 'transform 0.15s' }}>▼</span>
        </div>
      </div>
      {open && <div style={{ paddingBottom: 4 }}>{children}</div>}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, padding: '5px 0', fontSize: 'var(--font-size-sm)' }}>
      <span style={{ color: 'var(--color-ink-faint)' }}>{label}</span>
      <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{value ?? <span style={{ color: 'var(--color-ink-faint)' }}>—</span>}</span>
    </div>
  )
}

function GhostButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      style={{
        fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)',
        background: 'none', border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-sm)', padding: '3px 10px', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

const REL_LABELS: Record<string, string> = {
  active:       'Actief',
  at_risk:      'At risk',
  winding_down: 'Aflopend',
}

function formatCommissionDetail(c: ContractorSummary): string {
  if (c.commission_model === 'percentage' && c.commission_rate != null) {
    const pct = c.commission_rate < 1 ? c.commission_rate * 100 : c.commission_rate
    return `${pct.toFixed(1)}% van aanneemsom`
  }
  if (c.commission_model === 'flat_fee' && c.commission_rate != null) return `€${c.commission_rate.toLocaleString('nl-NL')} per deal`
  if (c.commission_model === 'retainer') {
    const parts: string[] = []
    if (c.monthly_retainer_fee) parts.push(`€${c.monthly_retainer_fee.toLocaleString('nl-NL')} fee/mnd`)
    if (c.monthly_ad_budget)    parts.push(`€${c.monthly_ad_budget.toLocaleString('nl-NL')} ad budget/mnd`)
    return parts.join(' · ') || 'Retainer'
  }
  return '—'
}

interface InfoData {
  created_at: string | null
  location:   string | null
}

interface ContractorDocument {
  id:               string
  document_type:    string
  title:            string
  file_size_bytes:  number | null
  mime_type:        string | null
  uploaded_at:      string
  notes:            string | null
  status:           string
  download_url:     string | null
}

function fmtFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtUploadDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const DOC_TYPE_OPTIONS = [
  { value: 'contract_signed', label: 'Contract (ondertekend)' },
  { value: 'contract',        label: 'Contract (verzonden)'   },
  { value: 'intake',          label: 'Intake'                 },
  { value: 'addendum',        label: 'Addendum'               },
  { value: 'other',           label: 'Overig'                 },
]

const ALLOWED_UPLOAD_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
])

function DocumentUploader({
  contractorId, defaultType = 'contract_signed', onUploaded,
}: {
  contractorId: string
  defaultType?: string
  onUploaded: () => void
}) {
  const [dragging, setDragging]   = useState(false)
  const [file, setFile]           = useState<File | null>(null)
  const [docType, setDocType]     = useState(defaultType)
  const [title, setTitle]         = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function selectFile(f: File) {
    if (!ALLOWED_UPLOAD_MIME.has(f.type)) {
      setError('Bestandstype niet toegestaan (PDF, DOCX, DOC, JPG, PNG)')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Bestand is te groot (max 10 MB)')
      return
    }
    setError(null)
    setFile(f)
    setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) selectFile(f)
  }

  async function upload() {
    if (!file) return
    setUploading(true)
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', docType)
    fd.append('title', title || file.name)
    const r = await fetch(`/api/contractors/${contractorId}/documents`, { method: 'POST', body: fd })
    setUploading(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError(j.error ?? 'Uploaden mislukt')
      return
    }
    setFile(null)
    setTitle('')
    onUploaded()
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)', padding: '5px 8px',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--color-ink)', width: '100%', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-2xs)', fontWeight: 600,
    color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  if (file) {
    return (
      <div style={{
        padding: '12px 14px', background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-ink)' }}>{file.name}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>{fmtFileSize(file.size)}</div>
          </div>
          <button onClick={() => { setFile(null); setError(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 14, padding: '2px 4px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>Type</label>
          <select value={docType} onChange={e => setDocType(e.target.value)} style={inputStyle}>
            {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>Titel</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </div>

        {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={upload} disabled={uploading}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '6px 14px',
              background: 'var(--color-accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)',
              cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading ? 'Uploaden…' : 'Uploaden'}
          </button>
          <button
            onClick={() => { setFile(null); setError(null) }}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '6px 12px',
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)',
            }}
          >
            Annuleren
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
        background: dragging ? 'var(--color-surface-raised)' : 'transparent',
        border: `1.5px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
        Sleep een document hier of{' '}
        <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>klik om te uploaden</span>
      </div>
      <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
        PDF, DOCX, JPG, PNG — max 10 MB
      </div>
      {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)', marginTop: 6 }}>{error}</div>}
      <input
        ref={inputRef} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f); e.target.value = '' }}
      />
    </div>
  )
}

function ActiveDocCard({ doc, onArchive }: { doc: ContractorDocument; onArchive: () => void }) {
  const isSigned    = doc.document_type === 'contract_signed'
  const statusLabel = isSigned ? 'Ondertekend' : 'In behandeling'
  const statusColor = isSigned ? 'var(--color-success)' : 'var(--color-warning)'

  return (
    <div style={{
      padding: '12px 14px', background: 'var(--color-surface-raised)',
      border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Actief contract
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-ink)' }}>
            {doc.title}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
            {fmtUploadDate(doc.uploaded_at)}
            {doc.mime_type?.includes('pdf') ? ' · PDF' : ''}
            {doc.file_size_bytes ? ` · ${fmtFileSize(doc.file_size_bytes)}` : ''}
          </span>
        </div>
        <span style={{
          fontSize: 'var(--font-size-2xs)', fontWeight: 600,
          color: statusColor, background: `${statusColor}22`,
          padding: '2px 8px', borderRadius: 'var(--radius-full)', flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {doc.download_url && (
          <a
            href={doc.download_url} target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: 'var(--font-size-xs)', padding: '4px 10px',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--color-ink)', textDecoration: 'none',
            }}
          >
            Download
          </a>
        )}
        <button
          onClick={onArchive}
          style={{
            fontSize: 'var(--font-size-xs)', padding: '4px 10px',
            background: 'none', border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-faint)',
          }}
        >
          Archiveren
        </button>
      </div>
    </div>
  )
}

function ContractSection({ contractorId }: { contractorId: string }) {
  const [docs, setDocs]               = useState<ContractorDocument[]>([])
  const [loading, setLoading]         = useState(true)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [showUploader, setShowUploader] = useState(false)

  async function loadDocs() {
    setLoading(true)
    const r = await fetch(`/api/contractors/${contractorId}/documents`)
    if (r.ok) setDocs(await r.json())
    setLoading(false)
  }

  useEffect(() => { loadDocs() }, [contractorId])

  if (loading) {
    return <div style={{ padding: '8px 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-faint)' }}>Laden…</div>
  }

  const activeSigned   = docs.find(d => d.status === 'active' && d.document_type === 'contract_signed')
  const activeContract = docs.find(d => d.status === 'active' && d.document_type === 'contract')
  const activeDoc      = activeSigned ?? activeContract
  const archived       = docs.filter(d => d.status === 'archived')
  const hasSignedActive = !!activeSigned

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Active contract card */}
      {activeDoc && (
        <ActiveDocCard
          doc={activeDoc}
          onArchive={async () => {
            await fetch(`/api/contractors/${contractorId}/documents/${activeDoc.id}`, { method: 'DELETE' })
            loadDocs()
          }}
        />
      )}

      {/* Upload zone — always visible if no signed contract; toggle if signed exists */}
      {!hasSignedActive ? (
        <DocumentUploader
          contractorId={contractorId}
          defaultType={activeDoc ? 'contract_signed' : 'contract'}
          onUploaded={loadDocs}
        />
      ) : (
        <>
          <button
            onClick={() => setShowUploader(o => !o)}
            style={{
              alignSelf: 'flex-start', fontSize: 'var(--font-size-xs)', padding: '5px 12px',
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)',
            }}
          >
            {showUploader ? 'Annuleren' : '+ Nieuw document uploaden'}
          </button>
          {showUploader && (
            <DocumentUploader
              contractorId={contractorId}
              defaultType="contract_signed"
              onUploaded={() => { setShowUploader(false); loadDocs() }}
            />
          )}
        </>
      )}

      {/* Archived versions */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setArchiveOpen(o => !o)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)',
            }}
          >
            <span style={{ display: 'inline-block', transform: archiveOpen ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s', fontSize: 9 }}>▶</span>
            Vorige versies ({archived.length})
          </button>
          {archiveOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {archived.map(doc => (
                <div key={doc.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', background: 'var(--color-surface-raised)',
                  borderRadius: 'var(--radius-sm)', opacity: 0.6,
                }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink)', fontWeight: 500 }}>{doc.title}</div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>{fmtUploadDate(doc.uploaded_at)}</div>
                  </div>
                  {doc.download_url && (
                    <a
                      href={doc.download_url} target="_blank" rel="noopener noreferrer"
                      style={{
                        fontSize: 'var(--font-size-2xs)', padding: '3px 8px',
                        background: 'none', border: '1px solid var(--color-border-subtle)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--color-ink-muted)', textDecoration: 'none',
                      }}
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

const KV_NOTES_PREFIX = 'contractor-notes-'

function InfoTab({ contractor }: { contractor: ContractorSummary }) {
  const { data: info } = useSWR<InfoData>(
    `/api/contractors/${contractor.id}/info`, fetcher, SWR_OPTS,
  )
  const [notes, setNotes]         = useState<string>('')
  const [notesDirty, setDirty]    = useState(false)
  const [notesSaving, setSaving]  = useState(false)
  const [notesSaved, setSaved]    = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.from('kv_store').select('value').eq('key', `${KV_NOTES_PREFIX}${contractor.id}`).single()
      .then(({ data }) => { if (data?.value) setNotes(data.value) })
  }, [contractor.id])

  function handleNotesChange(v: string) {
    setNotes(v)
    setDirty(true)
    setSaved(false)
  }

  async function saveNotes() {
    if (!notesDirty) return
    setSaving(true)
    await supabase.from('kv_store').upsert(
      { key: `${KV_NOTES_PREFIX}${contractor.id}`, value: notes },
      { onConflict: 'key' },
    )
    setSaving(false)
    setDirty(false)
    setSaved(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  const naamSince = info?.created_at
    ? new Date(info.created_at).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Profiel */}
      <CollapsibleSection title="Profiel" defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <InfoRow label="Naam"          value={contractor.name} />
          <InfoRow label="Niche"         value={contractor.niche} />
          <InfoRow label="Klant sinds"   value={naamSince} />
          <InfoRow label="Locatie"       value={info?.location} />
          <InfoRow label="Servicemodel"  value={SERVICE_LABEL[contractor.service_model ?? ''] ?? contractor.service_model} />
          <InfoRow label="Kwalificatie"  value={QUAL_LABEL[contractor.qualification_model ?? ''] ?? contractor.qualification_model} />
          <InfoRow label="Relatiestatus" value={REL_LABELS[contractor.relationship_status ?? ''] ?? contractor.relationship_status} />
          <InfoRow label="Commissiemodel" value={MODEL_LABEL[contractor.commission_model ?? ''] ?? contractor.commission_model} />
          <InfoRow label="Commissie"     value={formatCommissionDetail(contractor)} />
        </div>
        {(contractor.target_monthly_leads || contractor.target_monthly_revenue || contractor.target_commission) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Doelen / maand
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {contractor.target_monthly_leads != null && (
                <div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)' }}>
                    {contractor.target_monthly_leads}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>leads</div>
                </div>
              )}
              {contractor.target_monthly_revenue != null && (
                <div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)' }}>
                    €{(contractor.target_monthly_revenue / 1000).toFixed(0)}k
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>aanneemsom</div>
                </div>
              )}
              {contractor.target_commission != null && (
                <div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)' }}>
                    €{(contractor.target_commission / 1000).toFixed(0)}k
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>commissie</div>
                </div>
              )}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* SOP & ICP */}
      <CollapsibleSection
        title="SOP & ICP"
        defaultOpen={false}
        action={<GhostButton disabled>+ SOP toevoegen</GhostButton>}
      >
        <div style={{
          padding: '16px', background: 'var(--color-surface-raised)',
          border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-faint)', textAlign: 'center',
        }}>
          Geen SOPs gedefinieerd voor deze contractor
        </div>
      </CollapsibleSection>

      {/* Contracten */}
      <CollapsibleSection title="Contracten" defaultOpen>
        <ContractSection contractorId={contractor.id} />
      </CollapsibleSection>

      {/* Notities */}
      <CollapsibleSection title="Notities" defaultOpen>
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          onBlur={saveNotes}
          placeholder="Bijv. 'Owner Frank, prefereert WhatsApp'. Wordt automatisch opgeslagen."
          rows={5}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-ink)',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: 1.6,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {notesSaved && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>Opgeslagen</span>
          )}
          <button
            onClick={saveNotes}
            disabled={!notesDirty || notesSaving}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '4px 12px',
              background: notesDirty ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: notesDirty ? '#fff' : 'var(--color-ink-faint)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)', cursor: notesDirty ? 'pointer' : 'default',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {notesSaving ? 'Bezig…' : 'Opslaan'}
          </button>
        </div>
      </CollapsibleSection>

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
              {tab === 'pakketten'   && <PakkettanTab contractorId={contractor.id} />}
              {tab === 'offertes'    && <OffertesTab contractorId={contractor.id} />}
              {tab === 'info'        && <InfoTab contractor={contractor} />}
              {tab === 'locatie'     && <LocatieTab contractorId={contractor.id} contractorName={contractor.name} />}
            </div>
          </>
        )}
      </div>
    </>
  )
}
