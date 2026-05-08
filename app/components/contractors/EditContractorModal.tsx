'use client'

import { useEffect, useState } from 'react'
import { ContractorFormFields, type ContractorFormValues } from './ContractorFormFields'

interface Props {
  contractorId: string
  onSaved:      () => void
  onClose:      () => void
}

const EMPTY: ContractorFormValues = {
  name:         '',
  niche:        'bouw',
  serviceModel: 'full_sales',
  commModel:    'percentage',
  commRate:     '',
  boardId:      '',
  accountLabel: '',
  notes:        '',
}

export function EditContractorModal({ contractorId, onSaved, onClose }: Props) {
  const [values,   setValues]   = useState<ContractorFormValues>(EMPTY)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [warning,  setWarning]  = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/contractors/${contractorId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setValues({
          name:         data.name             ?? '',
          niche:        data.niche            ?? 'bouw',
          serviceModel: data.service_model    ?? 'full_sales',
          commModel:    data.commission_model ?? 'percentage',
          commRate:     data.commission_rate != null ? String(data.commission_rate) : '',
          boardId:      data.monday_board_id  ?? '',
          accountLabel: data.account_label    ?? '',
          notes:        data.notes            ?? '',
        })
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message ?? 'Laden mislukt')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [contractorId])

  function patch(p: Partial<ContractorFormValues>) {
    setValues(prev => ({ ...prev, ...p }))
  }

  async function submit() {
    if (!values.name.trim() || !values.boardId.trim() || !values.commRate) {
      setError('Vul alle verplichte velden in'); return
    }
    setSaving(true); setError(''); setWarning('')

    const r = await fetch(`/api/contractors/${contractorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:             values.name.trim(),
        niche:            values.niche,
        service_model:    values.serviceModel,
        commission_model: values.commModel,
        commission_rate:  parseFloat(values.commRate),
        monday_board_id:  values.boardId.trim(),
        notes:            values.notes.trim() || null,
        account_label:    values.accountLabel.trim() || null,
      }),
    })
    setSaving(false)

    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Opslaan mislukt')
      return
    }

    const j = await r.json().catch(() => ({}))
    const warns: string[] = (j as { warnings?: string[] }).warnings ?? []

    if (warns.length > 0) {
      setWarning(warns.join(' — '))
      setTimeout(() => { onSaved() }, 2200)
    } else {
      onSaved()
    }
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
            Aannemer bewerken
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '75vh' }}>
          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-faint)' }}>
              Laden…
            </div>
          ) : (
            <ContractorFormFields values={values} onChange={patch} />
          )}

          {warning && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', background: 'var(--color-warning-subtle, var(--color-surface-raised))', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-warning-subtle, var(--color-border))' }}>
              {warning}
            </div>
          )}
          {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>
            Annuleren
          </button>
          <button onClick={submit} disabled={loading || saving || !!warning} style={{ padding: '7px 16px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: (loading || saving || !!warning) ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: (loading || saving || !!warning) ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : 'Wijzigingen opslaan'}
          </button>
        </div>

      </div>
    </div>
  )
}
