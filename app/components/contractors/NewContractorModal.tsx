'use client'

import { useState } from 'react'

interface Props {
  onSaved: () => void
  onClose: () => void
}

const NICHES = [
  { value: 'bouw',     label: 'Bouw'     },
  { value: 'daken',    label: 'Daken'    },
  { value: 'dakkapel', label: 'Dakkapel' },
  { value: 'extras',   label: 'Extras'   },
]

const SERVICE_MODELS = [
  { value: 'full_sales',  label: 'Full sales',  sub: 'Leads + commissie op deal'      },
  { value: 'leads_only',  label: 'Leads only',  sub: 'Flat fee / pakket per lead'      },
  { value: 'hands_off',   label: 'Hands off',   sub: 'Retainer — wij doen alles'      },
]

const COMMISSION_MODELS = [
  { value: 'percentage', label: 'Percentage',  unit: (v: string) => `${v}%`         },
  { value: 'flat_fee',   label: 'Flat fee',    unit: () => '€/deal'                  },
  { value: 'retainer',   label: 'Retainer',    unit: () => '€/maand'                 },
]

const inp: React.CSSProperties = {
  padding: '7px 10px', width: '100%', boxSizing: 'border-box',
  background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--color-ink)',
  fontSize: 'var(--font-size-sm)', outline: 'none', fontFamily: 'inherit',
}
const lbl: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block',
}
const helper: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 3,
}

function Field({ label, required, children, helperText }: {
  label: string; required?: boolean; children: React.ReactNode; helperText?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={lbl}>
        {label}{required && <span style={{ color: 'var(--color-critical)' }}> *</span>}
      </label>
      {children}
      {helperText && <span style={helper}>{helperText}</span>}
    </div>
  )
}

export function NewContractorModal({ onSaved, onClose }: Props) {
  const [name,           setName]           = useState('')
  const [niche,          setNiche]          = useState('bouw')
  const [serviceModel,   setServiceModel]   = useState('full_sales')
  const [commModel,      setCommModel]      = useState('percentage')
  const [commRate,       setCommRate]       = useState('')
  const [boardId,        setBoardId]        = useState('')
  const [accountLabel,   setAccountLabel]   = useState('')
  const [notes,          setNotes]          = useState('')
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')
  const [toast,          setToast]          = useState('')

  const commUnitLabel = commModel === 'percentage' ? '%'
    : commModel === 'retainer' ? '€/maand' : '€/deal'

  async function submit() {
    if (!name.trim() || !boardId.trim() || !commRate) {
      setError('Vul alle verplichte velden in'); return
    }
    setSaving(true); setError('')

    const r = await fetch('/api/contractors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:             name.trim(),
        niche,
        service_model:    serviceModel,
        commission_model: commModel,
        commission_rate:  parseFloat(commRate),
        monday_board_id:  boardId.trim(),
        notes:            notes.trim() || undefined,
        account_label:    accountLabel.trim() || undefined,
      }),
    })
    setSaving(false)

    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Opslaan mislukt')
      return
    }

    setToast('Aannemer toegevoegd. Eerste sync gestart, leads verschijnen binnen 1–2 minuten.')
    setTimeout(() => { onSaved() }, 1800)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            Nieuwe aannemer
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '75vh' }}>

          {/* Name + niche row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12 }}>
            <Field label="Naam" required>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder='bijv. "Dak & Zo BV"' style={inp}
              />
            </Field>
            <Field label="Niche" required>
              <select value={niche} onChange={e => setNiche(e.target.value)} style={inp}>
                {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Service model */}
          <Field label="Servicemodel" required>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SERVICE_MODELS.map(sm => (
                <label key={sm.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${serviceModel === sm.value ? 'var(--color-accent)' : 'var(--color-border)'}`, background: serviceModel === sm.value ? 'var(--color-accent-subtle, var(--color-surface-raised))' : 'transparent' }}>
                  <input type="radio" name="service_model" value={sm.value} checked={serviceModel === sm.value} onChange={() => setServiceModel(sm.value)} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink)' }}>{sm.label}</div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>{sm.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          {/* Commission model + rate row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Commissiemodel" required>
              <select value={commModel} onChange={e => setCommModel(e.target.value)} style={inp}>
                {COMMISSION_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label={`Commissie (${commUnitLabel})`} required>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {commModel !== 'percentage' && (
                  <span style={{ padding: '7px 8px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRight: 'none', borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)' }}>€</span>
                )}
                <input
                  type="number" step="any" min="0"
                  value={commRate} onChange={e => setCommRate(e.target.value)}
                  placeholder={commModel === 'percentage' ? '5' : commModel === 'retainer' ? '1000' : '150'}
                  style={{ ...inp, borderRadius: commModel !== 'percentage' ? '0 var(--radius-sm) var(--radius-sm) 0' : 'var(--radius-sm)' }}
                />
                {commModel === 'percentage' && (
                  <span style={{ padding: '7px 8px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderLeft: 'none', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)' }}>%</span>
                )}
              </div>
            </Field>
          </div>

          {/* Monday board ID */}
          <Field
            label="Monday board ID" required
            helperText="Te vinden in de URL van het board: monday.com/boards/{ID}"
          >
            <input
              type="text" value={boardId} onChange={e => setBoardId(e.target.value)}
              placeholder="bijv. 5091704359" style={inp}
            />
          </Field>

          {/* Account label */}
          <Field
            label="Account label"
            helperText="Alleen invullen als leads via Client Projects board komen — laat leeg voor eigen board"
          >
            <input
              type="text" value={accountLabel} onChange={e => setAccountLabel(e.target.value)}
              placeholder='bijv. "Dak & Zo BV"' style={inp}
            />
          </Field>

          {/* Notes */}
          <Field label="Notities">
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Interne notities…"
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />
          </Field>

          {toast && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', background: 'var(--color-success-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
              {toast}
            </div>
          )}
          {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>
            Annuleren
          </button>
          <button onClick={submit} disabled={saving || !!toast} style={{ padding: '7px 16px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: (saving || !!toast) ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: (saving || !!toast) ? 0.7 : 1 }}>
            {saving ? 'Toevoegen…' : 'Aannemer toevoegen'}
          </button>
        </div>

      </div>
    </div>
  )
}
