'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { REJECTION_REASONS, type RejectionReason } from './rejection-reasons'

interface Props {
  creativeId: string
  isOpen:     boolean
  onClose:    () => void
  onSubmit:   (reason: RejectionReason, notes: string) => void
}

export function RejectionModal({ isOpen, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<RejectionReason | ''>('')
  const [notes,  setNotes]  = useState('')

  if (!isOpen) return null

  function handleSubmit() {
    if (!reason) return
    onSubmit(reason as RejectionReason, notes.trim())
    setReason('')
    setNotes('')
  }

  function handleClose() {
    setReason('')
    setNotes('')
    onClose()
  }

  return createPortal(
    <div
      onClick={handleClose}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.60)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         9999,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:    'var(--color-surface)',
          border:        '1px solid var(--color-border)',
          borderRadius:  'var(--radius-xl)',
          padding:       24,
          width:         340,
          display:       'flex',
          flexDirection: 'column',
          gap:           14,
        }}
      >
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
          Waarom skip je deze creative?
        </div>

        <select
          value={reason}
          onChange={e => setReason(e.target.value as RejectionReason)}
          style={{
            background:   'var(--color-surface-raised)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color:        reason ? 'var(--color-ink)' : 'var(--color-ink-muted)',
            fontSize:     'var(--font-size-sm)',
            padding:      '8px 10px',
            width:        '100%',
            outline:      'none',
            cursor:       'pointer',
          }}
        >
          <option value="" disabled>Kies reden…</option>
          {REJECTION_REASONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optionele toelichting…"
          rows={3}
          style={{
            background:  'var(--color-surface-raised)',
            border:      '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color:       'var(--color-ink)',
            fontSize:    'var(--font-size-sm)',
            padding:     '8px 10px',
            width:       '100%',
            resize:      'vertical',
            outline:     'none',
            fontFamily:  'inherit',
            lineHeight:  1.5,
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            style={{
              padding:      '7px 14px',
              background:   'none',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color:        'var(--color-ink-muted)',
              fontSize:     'var(--font-size-sm)',
              cursor:       'pointer',
            }}
          >
            Annuleer
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason}
            style={{
              padding:      '7px 14px',
              background:   reason ? 'var(--color-surface-raised)' : 'transparent',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color:        reason ? 'var(--color-critical)' : 'var(--color-ink-faint)',
              fontSize:     'var(--font-size-sm)',
              fontWeight:   600,
              cursor:       reason ? 'pointer' : 'default',
            }}
          >
            👎 Skip
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
