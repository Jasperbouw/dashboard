'use client'

import { useState } from 'react'
import { ContractorFormFields, type ContractorFormValues } from './ContractorFormFields'

interface Props {
  onSaved: () => void
  onClose: () => void
}

const DEFAULTS: ContractorFormValues = {
  name:         '',
  niche:        'bouw',
  serviceModel: 'full_sales',
  commModel:    'percentage',
  commRate:     '',
  boardId:      '',
  accountLabel: '',
  notes:        '',
}

export function NewContractorModal({ onSaved, onClose }: Props) {
  const [values,  setValues]  = useState<ContractorFormValues>(DEFAULTS)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [toast,   setToast]   = useState('')

  function patch(p: Partial<ContractorFormValues>) {
    setValues(prev => ({ ...prev, ...p }))
  }

  async function submit() {
    if (!values.name.trim() || !values.boardId.trim() || !values.commRate) {
      setError('Vul alle verplichte velden in'); return
    }
    setSaving(true); setError('')

    const r = await fetch('/api/contractors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:             values.name.trim(),
        niche:            values.niche,
        service_model:    values.serviceModel,
        commission_model: values.commModel,
        commission_rate:  parseFloat(values.commRate),
        monday_board_id:  values.boardId.trim(),
        notes:            values.notes.trim() || undefined,
        account_label:    values.accountLabel.trim() || undefined,
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
          <ContractorFormFields values={values} onChange={patch} />

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
