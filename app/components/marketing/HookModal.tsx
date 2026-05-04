'use client'

import { useState } from 'react'

export interface Hook {
  id:             string
  name:           string
  niche:          string
  description:    string
  visual_concept: string | null
  status:         'testing' | 'winner' | 'dead'
  times_used:     number
  last_used_at:   string | null
  created_at:     string
  updated_at:     string
}

const NICHES = [
  { value: 'bouw',     label: 'Bouw'     },
  { value: 'daken',    label: 'Daken'    },
  { value: 'dakkapel', label: 'Dakkapel' },
  { value: 'extras',   label: 'Extras'   },
]

const STATUSES = [
  { value: 'testing', label: 'Testing' },
  { value: 'winner',  label: 'Winner'  },
  { value: 'dead',    label: 'Dead'    },
]

interface Props {
  hook?:    Hook          // undefined = create, defined = edit
  defaultNiche?: string   // pre-select niche when opening from a niche section
  onSaved:  (hook: Hook) => void
  onClose:  () => void
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

export function HookModal({ hook, defaultNiche, onSaved, onClose }: Props) {
  const isEdit = !!hook

  const [form, setForm] = useState({
    name:           hook?.name           ?? '',
    niche:          hook?.niche          ?? defaultNiche ?? 'bouw',
    description:    hook?.description    ?? '',
    visual_concept: hook?.visual_concept ?? '',
    status:         hook?.status         ?? 'testing',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    if (!form.name.trim() || !form.description.trim()) {
      setError('Naam en beschrijving zijn verplicht'); return
    }
    setSaving(true); setError('')

    const url    = isEdit ? `/api/hooks/${hook.id}` : '/api/hooks'
    const method = isEdit ? 'PATCH' : 'POST'

    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:           form.name.trim(),
        niche:          form.niche,
        description:    form.description.trim(),
        visual_concept: form.visual_concept.trim() || null,
        status:         form.status,
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
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            {isEdit ? 'Hook bewerken' : 'Nieuwe hook'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '70vh' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Niche *</label>
              <select value={form.niche} onChange={e => set('niche', e.target.value)} style={inp}>
                {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Naam *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder='bijv. "Lekkend dak = stille schade"'
              style={inp}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Beschrijving *</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="De hoek / pitch — wat is de kern van deze hook?"
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Visual concept <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optioneel)</span></label>
            <textarea
              value={form.visual_concept}
              onChange={e => set('visual_concept', e.target.value)}
              rows={2}
              placeholder="Visuele richting voor de afbeelding generatie…"
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>
            Annuleren
          </button>
          <button onClick={submit} disabled={saving} style={{ padding: '7px 16px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : isEdit ? 'Opslaan' : 'Toevoegen'}
          </button>
        </div>

      </div>
    </div>
  )
}
