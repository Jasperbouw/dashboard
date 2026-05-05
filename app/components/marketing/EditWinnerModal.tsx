'use client'

import { useState } from 'react'
import type { Winner } from './types'
import { CPL_WINNER_THRESHOLD } from './types'

interface Props {
  winner:  Winner
  onSaved: (winner: Winner) => void
  onClose: () => void
}

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

function NumField({ label, value, onChange, prefix }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={lbl}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {prefix && (
          <span style={{ padding: '7px 8px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRight: 'none', borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)' }}>
            {prefix}
          </span>
        )}
        <input
          type="number" step="any" min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inp, borderRadius: prefix ? '0 var(--radius-sm) var(--radius-sm) 0' : 'var(--radius-sm)' }}
        />
      </div>
    </div>
  )
}

export function EditWinnerModal({ winner, onSaved, onClose }: Props) {
  const [overlayText, setOverlayText] = useState(winner.overlay_text ?? '')
  const [notes,       setNotes]       = useState(winner.notes ?? '')
  const [spend,       setSpend]       = useState(String(winner.spend ?? ''))
  const [impressions, setImpressions] = useState(String(winner.impressions ?? ''))
  const [ctr,         setCtr]         = useState(String(winner.ctr ?? ''))
  const [cpl,         setCpl]         = useState(String(winner.cpl ?? ''))
  const [leads,       setLeads]       = useState(String(winner.leads ?? ''))
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const previewCpl    = cpl ? parseFloat(cpl) : null
  const wouldBeWinner = previewCpl !== null && previewCpl <= CPL_WINNER_THRESHOLD

  async function submit() {
    setSaving(true); setError('')
    const r = await fetch(`/api/winners/${winner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overlay_text: overlayText.trim() || null,
        notes:        notes.trim()       || null,
        spend:        spend       ? parseFloat(spend)        : null,
        impressions:  impressions ? parseInt(impressions, 10): null,
        ctr:          ctr         ? parseFloat(ctr)          : null,
        cpl:          cpl         ? parseFloat(cpl)          : null,
        leads:        leads       ? parseInt(leads, 10)      : null,
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Opslaan mislukt')
      return
    }
    onSaved(await r.json())
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
            Winner bewerken
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: '75vh' }}>

          {/* Image preview — read-only */}
          <img
            src={winner.image_url}
            alt="winner"
            style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
          />

          {/* Overlay text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Overlay tekst</label>
            <textarea
              value={overlayText}
              onChange={e => setOverlayText(e.target.value)}
              rows={2}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Notities</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Stats */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink)' }}>
                Meta statistieken
              </div>
              {previewCpl !== null && (
                <span style={{
                  fontSize: 'var(--font-size-2xs)', fontWeight: 600, padding: '2px 7px',
                  borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.04em',
                  color:      wouldBeWinner ? 'var(--color-success)' : 'var(--color-ink-faint)',
                  background: wouldBeWinner ? 'var(--color-success-subtle)' : 'var(--color-surface-raised)',
                }}>
                  {wouldBeWinner ? '✓ Winner' : `CPL boven €${CPL_WINNER_THRESHOLD}`}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <NumField label="Spend"       value={spend}       onChange={setSpend}       prefix="€" />
              <NumField label="Impressions" value={impressions} onChange={setImpressions} />
              <NumField label="CTR"         value={ctr}         onChange={setCtr}         prefix="%" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <NumField label="CPL"         value={cpl}         onChange={setCpl}         prefix="€" />
              <NumField label="Leads"       value={leads}       onChange={setLeads}       />
            </div>
          </div>

          {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>
            Annuleren
          </button>
          <button onClick={submit} disabled={saving} style={{ padding: '7px 16px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>

      </div>
    </div>
  )
}
