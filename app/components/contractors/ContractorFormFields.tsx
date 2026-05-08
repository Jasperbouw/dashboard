'use client'

import type React from 'react'

export const NICHES = [
  { value: 'bouw',     label: 'Bouw'     },
  { value: 'daken',    label: 'Daken'    },
  { value: 'dakkapel', label: 'Dakkapel' },
  { value: 'extras',   label: 'Extras'   },
]

export const SERVICE_MODELS = [
  { value: 'full_sales', label: 'Full sales', sub: 'Leads + commissie op deal'  },
  { value: 'leads_only', label: 'Leads only', sub: 'Flat fee / pakket per lead' },
  { value: 'hands_off',  label: 'Hands off',  sub: 'Retainer — wij doen alles'  },
]

export const COMMISSION_MODELS = [
  { value: 'percentage', label: 'Percentage', unit: (v: string) => `${v}%`  },
  { value: 'flat_fee',   label: 'Flat fee',   unit: () => '€/deal'           },
  { value: 'retainer',   label: 'Retainer',   unit: () => '€/maand'          },
]

export const inp: React.CSSProperties = {
  padding: '7px 10px', width: '100%', boxSizing: 'border-box',
  background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--color-ink)',
  fontSize: 'var(--font-size-sm)', outline: 'none', fontFamily: 'inherit',
}
export const lbl: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block',
}
export const helper: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 3,
}

export function Field({ label, required, children, helperText }: {
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

export interface ContractorFormValues {
  name:         string
  niche:        string
  serviceModel: string
  commModel:    string
  commRate:     string
  boardId:      string
  accountLabel: string
  notes:        string
}

interface Props {
  values:   ContractorFormValues
  onChange: (patch: Partial<ContractorFormValues>) => void
}

export function ContractorFormFields({ values, onChange }: Props) {
  const { name, niche, serviceModel, commModel, commRate, boardId, accountLabel, notes } = values

  const commUnitLabel = commModel === 'percentage' ? '%'
    : commModel === 'retainer' ? '€/maand' : '€/deal'

  return (
    <>
      {/* Name + niche */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12 }}>
        <Field label="Naam" required>
          <input
            type="text" value={name} onChange={e => onChange({ name: e.target.value })}
            placeholder='bijv. "Dak & Zo BV"' style={inp}
          />
        </Field>
        <Field label="Niche" required>
          <select value={niche} onChange={e => onChange({ niche: e.target.value })} style={inp}>
            {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </Field>
      </div>

      {/* Service model */}
      <Field label="Servicemodel" required>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SERVICE_MODELS.map(sm => (
            <label key={sm.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${serviceModel === sm.value ? 'var(--color-accent)' : 'var(--color-border)'}`, background: serviceModel === sm.value ? 'var(--color-accent-subtle, var(--color-surface-raised))' : 'transparent' }}>
              <input type="radio" name="service_model" value={sm.value} checked={serviceModel === sm.value} onChange={() => onChange({ serviceModel: sm.value })} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink)' }}>{sm.label}</div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>{sm.sub}</div>
              </div>
            </label>
          ))}
        </div>
      </Field>

      {/* Commission model + rate */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Commissiemodel" required>
          <select value={commModel} onChange={e => onChange({ commModel: e.target.value })} style={inp}>
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
              value={commRate} onChange={e => onChange({ commRate: e.target.value })}
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
          type="text" value={boardId} onChange={e => onChange({ boardId: e.target.value })}
          placeholder="bijv. 5091704359" style={inp}
        />
      </Field>

      {/* Account label */}
      <Field
        label="Account label"
        helperText="Alleen invullen als leads via Client Projects board komen — laat leeg voor eigen board"
      >
        <input
          type="text" value={accountLabel} onChange={e => onChange({ accountLabel: e.target.value })}
          placeholder='bijv. "Dak & Zo BV"' style={inp}
        />
      </Field>

      {/* Notes */}
      <Field label="Notities">
        <textarea
          value={notes} onChange={e => onChange({ notes: e.target.value })}
          rows={2} placeholder="Interne notities…"
          style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
        />
      </Field>
    </>
  )
}
