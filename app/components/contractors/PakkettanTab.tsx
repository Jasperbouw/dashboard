'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 30_000 } as const

const NICHES: { value: string; label: string }[] = [
  { value: 'bouw',     label: 'Bouw' },
  { value: 'daken',    label: 'Daken' },
  { value: 'dakkapel', label: 'Dakkapel' },
  { value: 'extras',   label: 'Extras' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadPack {
  id:                       string
  contractor_id:            string
  niche:                    string
  pack_type:                'budget_based' | 'lead_based'
  units_promised:           number
  units_used:               number
  units_offset:             number
  amount_paid:              number | null
  paid_at:                  string | null
  started_at:               string
  completed_at:             string | null
  status:                   'active' | 'completed' | 'paused'
  related_revenue_entry_id: string | null
  notes:                    string | null
  created_at:               string
  updated_at:               string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(v: number | null | undefined) {
  if (v == null) return '—'
  return `€${v.toLocaleString('nl-NL')}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysSince(iso: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

function estimatedCompletion(pack: LeadPack): string | null {
  const used      = Number(pack.units_used)
  const promised  = Number(pack.units_promised)
  const days      = daysSince(pack.started_at)
  const avgPerDay = used / days
  if (avgPerDay < 0.1) return null
  const remaining = promised - used
  if (remaining <= 0) return null
  const daysLeft = Math.ceil(remaining / avgPerDay)
  const eta = new Date(Date.now() + daysLeft * 86_400_000)
  return eta.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, warn }: { pct: number; warn: boolean }) {
  const color = warn ? 'var(--color-warning)' : 'var(--color-accent)'
  return (
    <div style={{ height: 8, borderRadius: 4, background: 'var(--color-surface-raised)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, pct)}%`,
        background: color, borderRadius: 4,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

// ── Pack modal (create + edit) ────────────────────────────────────────────────

const EMPTY_FORM = {
  niche:          '',
  pack_type:      'lead_based' as 'lead_based' | 'budget_based',
  units_promised: '',
  units_offset:   '0',
  amount_paid:    '',
  started_at:     new Date().toISOString().slice(0, 10),
  notes:          '',
}

function PackModal({
  contractorId,
  pack,
  onClose,
  onSaved,
}: {
  contractorId: string
  pack?: LeadPack
  onClose: () => void
  onSaved: (pack: LeadPack) => void
}) {
  const isEdit = pack != null
  const [form, setForm] = useState(isEdit ? {
    niche:          pack.niche,
    pack_type:      pack.pack_type,
    units_promised: String(pack.units_promised),
    units_offset:   String(pack.units_offset ?? 0),
    amount_paid:    pack.amount_paid != null ? String(pack.amount_paid) : '',
    started_at:     pack.started_at.slice(0, 10),
    notes:          pack.notes ?? '',
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.niche || !form.units_promised || !form.started_at) {
      setErr('Niche, aantal en startdatum zijn verplicht')
      return
    }
    setSaving(true)
    setErr(null)
    const url    = isEdit
      ? `/api/contractors/${contractorId}/lead-packs/${pack.id}`
      : `/api/contractors/${contractorId}/lead-packs`
    const method = isEdit ? 'PATCH' : 'POST'
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        niche:          form.niche,
        pack_type:      form.pack_type,
        units_promised: Number(form.units_promised),
        units_offset:   Number(form.units_offset) || 0,
        amount_paid:    form.amount_paid ? Number(form.amount_paid) : null,
        started_at:     form.started_at,
        notes:          form.notes || null,
      }),
    })
    setSaving(false)
    if (!r.ok) { const j = await r.json(); setErr(j.error ?? 'Opslaan mislukt'); return }
    onSaved(await r.json())
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-sm)', padding: '7px 10px',
    fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', fontFamily: 'inherit',
    outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-ink-faint)',
    display: 'block', marginBottom: 4,
  }
  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 24, width: 440,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', color: 'var(--color-ink)' }}>
            {isEdit ? 'Pakket bewerken' : 'Nieuw pakket'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-ink-faint)', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Niche + type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Niche *</label>
              <select value={form.niche} onChange={e => set('niche', e.target.value)} style={inputStyle} required>
                <option value="">— kies niche —</option>
                {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Type *</label>
              <select value={form.pack_type} onChange={e => set('pack_type', e.target.value as 'lead_based' | 'budget_based')} style={inputStyle}>
                <option value="lead_based">Lead-based (aantal leads)</option>
                <option value="budget_based">Budget-based (euros)</option>
              </select>
            </div>
          </div>

          {/* Units + amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>
                {form.pack_type === 'lead_based' ? 'Aantal leads *' : 'Budget (€) *'}
              </label>
              <input
                type="number" min="1" step={form.pack_type === 'budget_based' ? '100' : '1'}
                value={form.units_promised}
                onChange={e => set('units_promised', e.target.value)}
                placeholder={form.pack_type === 'lead_based' ? '20' : '5000'}
                style={inputStyle} required
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Betaald bedrag (€)</label>
              <input
                type="number" min="0" step="0.01"
                value={form.amount_paid}
                onChange={e => set('amount_paid', e.target.value)}
                placeholder="400"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Offset — lead-based only */}
          {form.pack_type === 'lead_based' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Reeds geleverd</label>
              <input
                type="number" min="0" step="1"
                value={form.units_offset}
                onChange={e => set('units_offset', e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>
                Leads die al binnen waren voordat het pakket werd aangemaakt
              </span>
            </div>
          )}

          {/* Start date */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Startdatum *</label>
            <input
              type="date"
              value={form.started_at}
              onChange={e => set('started_at', e.target.value)}
              style={inputStyle} required
            />
          </div>

          {/* Notes */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Notities</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Optioneel"
              style={inputStyle}
            />
          </div>

          {err && (
            <div style={{
              fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)',
              padding: '6px 10px', background: 'var(--color-critical-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', padding: '8px 16px' }}>
              Annuleren
            </button>
            <button
              type="submit" disabled={saving}
              style={{
                padding: '8px 20px', background: 'var(--color-accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontSize: 'var(--font-size-sm)', fontWeight: 500, opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Bezig…' : isEdit ? 'Opslaan' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Spend update modal ────────────────────────────────────────────────────────

function SpendModal({
  pack,
  contractorId,
  onClose,
  onSaved,
}: {
  pack: LeadPack
  contractorId: string
  onClose: () => void
  onSaved: (updated: LeadPack) => void
}) {
  const [spend, setSpend] = useState(String(pack.units_used || ''))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!spend) { setErr('Vul huidige spend in'); return }
    setSaving(true)
    setErr(null)
    const r = await fetch(`/api/contractors/${contractorId}/lead-packs/${pack.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ units_used: Number(spend) }),
    })
    setSaving(false)
    if (!r.ok) { const j = await r.json(); setErr(j.error ?? 'Opslaan mislukt'); return }
    onSaved(await r.json())
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-sm)', padding: '7px 10px',
    fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 24, width: 360,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', color: 'var(--color-ink)' }}>
            Update spend
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-ink-faint)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginBottom: 16 }}>
          Totale Meta spend voor dit pakket ({pack.niche}) t/m vandaag.
          Budget: {fmtEur(pack.units_promised)}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-ink-faint)' }}>
              Huidige spend (€) *
            </label>
            <input
              autoFocus
              type="number" min="0" step="0.01"
              value={spend}
              onChange={e => setSpend(e.target.value)}
              placeholder="1500"
              style={inputStyle}
              required
            />
          </div>

          {err && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{err}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', padding: '7px 14px' }}>
              Annuleren
            </button>
            <button
              type="submit" disabled={saving}
              style={{
                padding: '7px 18px', background: 'var(--color-accent)', color: '#fff',
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

// ── Active pack card ──────────────────────────────────────────────────────────

function ActivePackCard({
  pack,
  contractorId,
  onUpdate,
  onClose: onMarkClosed,
  onEdit,
}: {
  pack: LeadPack
  contractorId: string
  onUpdate: (updated: LeadPack) => void
  onClose: (id: string) => void
  onEdit: () => void
}) {
  const [spendModal, setSpendModal] = useState(false)
  const [closing, setClosing] = useState(false)

  const used      = Number(pack.units_used)
  const promised  = Number(pack.units_promised)
  const pct       = promised > 0 ? (used / promised) * 100 : 0
  const warn      = pct >= 80
  const isBudget  = pack.pack_type === 'budget_based'
  const eta       = estimatedCompletion(pack)

  async function markCompleted() {
    if (!confirm('Pakket markeren als voltooid?')) return
    setClosing(true)
    const r = await fetch(`/api/contractors/${contractorId}/lead-packs/${pack.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    setClosing(false)
    if (r.ok) onMarkClosed(pack.id)
  }

  return (
    <>
      {spendModal && (
        <SpendModal
          pack={pack}
          contractorId={contractorId}
          onClose={() => setSpendModal(false)}
          onSaved={updated => { onUpdate(updated); setSpendModal(false) }}
        />
      )}

      <div style={{
        background: 'var(--color-surface-raised)',
        border: `1px solid ${warn ? 'var(--color-warning)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{
                fontSize: 'var(--font-size-2xs)', fontWeight: 700,
                color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Actief
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>—</span>
              <span style={{
                fontSize: 'var(--font-size-xs)', fontWeight: 600,
                color: 'var(--color-ink-muted)',
              }}>
                {pack.niche}
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-ink)' }}>
              {isBudget
                ? `Budget €${promised.toLocaleString('nl-NL')}`
                : `${promised} leads pakket`}
              {pack.amount_paid != null && (
                <span style={{ fontWeight: 400, color: 'var(--color-ink-muted)' }}>
                  {' '}— {fmtEur(pack.amount_paid)} betaald
                </span>
              )}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 2 }}>
              Gestart: {fmtDate(pack.started_at)}
            </div>
            {(pack.units_offset ?? 0) > 0 && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 1 }}>
                Reeds geleverd bij start: {pack.units_offset} leads
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 8 }}>
          <ProgressBar pct={pct} warn={warn} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{
            fontSize: 'var(--font-size-sm)', fontWeight: 600,
            color: warn ? 'var(--color-warning)' : 'var(--color-ink)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {isBudget
              ? `${fmtEur(used)} / ${fmtEur(promised)}`
              : `${used} / ${promised} leads`}
            <span style={{ fontWeight: 400, color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-xs)', marginLeft: 6 }}>
              ({Math.round(pct)}%)
            </span>
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
            {isBudget
              ? `Resterend: ${fmtEur(Math.max(0, promised - used))}`
              : `Nog te leveren: ${Math.max(0, promised - used)} leads`}
          </span>
        </div>

        {eta && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginBottom: 10 }}>
            Verwacht op: ±{eta} (op huidige snelheid)
          </div>
        )}
        {!eta && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginBottom: 10 }}>
            Verwacht op: Onvoldoende data
          </div>
        )}

        {pack.notes && (
          <div style={{
            fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)',
            fontStyle: 'italic', marginBottom: 10,
          }}>
            {pack.notes}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onEdit}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '4px 10px',
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              color: 'var(--color-ink-muted)',
            }}
          >
            Bewerken
          </button>
          <button
            onClick={markCompleted} disabled={closing}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '4px 10px',
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              color: 'var(--color-ink-muted)', opacity: closing ? 0.6 : 1,
            }}
          >
            Pakket sluiten
          </button>
          {isBudget && (
            <button
              onClick={() => setSpendModal(true)}
              style={{
                fontSize: 'var(--font-size-xs)', padding: '4px 10px',
                background: 'none', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                color: 'var(--color-ink-muted)',
              }}
            >
              Update spend
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function PakkettanTab({ contractorId, onPacksChanged }: { contractorId: string; onPacksChanged?: () => void }) {
  const { data: rawPacks, isLoading, error, mutate } = useSWR<LeadPack[]>(
    `/api/contractors/${contractorId}/lead-packs`, fetcher, SWR_OPTS,
  )

  const [showNew, setShowNew]         = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editPack, setEditPack]       = useState<LeadPack | null>(null)

  const packs = rawPacks ?? []

  const active    = packs.filter(p => p.status === 'active')
  const historical = packs.filter(p => p.status !== 'active')

  function updatePack(updated: LeadPack) {
    mutate(prev => (prev ?? []).map(p => p.id === updated.id ? updated : p), false)
    onPacksChanged?.()
  }

  function removePack(id: string) {
    mutate(prev => (prev ?? []).filter(p => p.id !== id), false)
    onPacksChanged?.()
  }

  function addPack(pack: LeadPack) {
    mutate(prev => [pack, ...(prev ?? [])], false)
    onPacksChanged?.()
  }

  if (isLoading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
      Laden…
    </div>
  )

  if (error) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-critical)', fontSize: 'var(--font-size-sm)' }}>
      Fout bij laden: {error.message}
    </div>
  )

  return (
    <>
      {showNew && (
        <PackModal
          contractorId={contractorId}
          onClose={() => setShowNew(false)}
          onSaved={pack => { addPack(pack); setShowNew(false) }}
        />
      )}
      {editPack && (
        <PackModal
          contractorId={contractorId}
          pack={editPack}
          onClose={() => setEditPack(null)}
          onSaved={() => { mutate(); setEditPack(null); onPacksChanged?.() }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 600,
            color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Actieve pakketten {active.length > 0 && `(${active.length})`}
          </div>
          <button
            onClick={() => setShowNew(true)}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '4px 12px',
              background: 'var(--color-accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500,
            }}
          >
            + Nieuw pakket
          </button>
        </div>

        {/* Active packs */}
        {active.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center',
            background: 'var(--color-surface-raised)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-faint)',
          }}>
            Geen actieve pakketten
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {active.map(pack => (
              <ActivePackCard
                key={pack.id}
                pack={pack}
                contractorId={contractorId}
                onUpdate={updatePack}
                onClose={removePack}
                onEdit={() => setEditPack(pack)}
              />
            ))}
          </div>
        )}

        {/* History */}
        {historical.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)',
              }}
            >
              <span style={{
                display: 'inline-block',
                transform: showHistory ? 'rotate(90deg)' : undefined,
                transition: 'transform 0.15s', fontSize: 9,
              }}>▶</span>
              Geschiedenis ({historical.length})
            </button>

            {showHistory && (
              <div style={{
                marginTop: 8,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Niche', 'Type', 'Eenheden', 'Periode', 'Status'].map(h => (
                        <th key={h} style={{
                          padding: '7px 10px', fontSize: 'var(--font-size-2xs)',
                          fontWeight: 600, color: 'var(--color-ink-faint)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          textAlign: 'left', borderBottom: '1px solid var(--color-border)',
                          whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historical.map(pack => {
                      const isBudget = pack.pack_type === 'budget_based'
                      return (
                        <tr key={pack.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '8px 10px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink)', fontWeight: 500 }}>
                            {pack.niche}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
                            {isBudget ? 'Budget' : 'Leads'}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
                            {isBudget
                              ? `${fmtEur(pack.units_used)} / ${fmtEur(pack.units_promised)}`
                              : `${pack.units_used} / ${pack.units_promised}`}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', whiteSpace: 'nowrap' }}>
                            {fmtDate(pack.started_at)}
                            {pack.completed_at && ` → ${fmtDate(pack.completed_at)}`}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                              color: pack.status === 'completed' ? 'var(--color-success)' : 'var(--color-ink-faint)',
                              background: pack.status === 'completed' ? 'var(--color-success-subtle)' : 'var(--color-surface-raised)',
                              borderRadius: 'var(--radius-full)', padding: '1px 7px',
                            }}>
                              {pack.status === 'completed' ? 'Voltooid' : 'Gepauzeerd'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  )
}
