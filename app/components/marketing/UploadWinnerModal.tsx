'use client'

import { useRef, useState } from 'react'
import type { Winner } from './types'
import { MARKETING_NICHES } from './types'

interface Props {
  defaultNiche?: string
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

function NumInput({ label, name, value, onChange, prefix }: {
  label: string; name: string; value: string
  onChange: (v: string) => void; prefix?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={lbl}>{label} *</label>
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

export function UploadWinnerModal({ defaultNiche, onSaved, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file,        setFile]        = useState<File | null>(null)
  const [preview,     setPreview]     = useState<string | null>(null)
  const [dragging,    setDragging]    = useState(false)
  const [niche,       setNiche]       = useState(defaultNiche ?? 'bouw')
  const [overlayText, setOverlayText] = useState('')
  const [notes,       setNotes]       = useState('')
  const [spend,       setSpend]       = useState('')
  const [impressions, setImpressions] = useState('')
  const [ctr,         setCtr]         = useState('')
  const [cpl,         setCpl]         = useState('')
  const [leads,       setLeads]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  function pickFile(f: File) {
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) pickFile(f)
  }

  async function submit() {
    if (!file)   { setError('Selecteer een afbeelding'); return }
    if (!niche)  { setError('Kies een niche'); return }
    if (!spend || !impressions || !ctr || !cpl || !leads) {
      setError('Alle statistieken zijn verplicht'); return
    }

    setSaving(true); setError('')
    const fd = new FormData()
    fd.append('image',        file)
    fd.append('niche',        niche)
    fd.append('overlay_text', overlayText.trim())
    fd.append('notes',        notes.trim())
    fd.append('spend',        spend)
    fd.append('impressions',  impressions)
    fd.append('ctr',          ctr)
    fd.append('cpl',          cpl)
    fd.append('leads',        leads)

    const r = await fetch('/api/winners', { method: 'POST', body: fd })
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
      <div style={{ width: '100%', maxWidth: 580, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            Winner toevoegen
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: '75vh' }}>

          {/* Image upload */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Afbeelding *</label>
            {preview ? (
              <div style={{ position: 'relative' }}>
                <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
                <button
                  onClick={() => { setFile(null); setPreview(null) }}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}
                >
                  Wijzigen
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '32px 20px', textAlign: 'center',
                  cursor: 'pointer', background: dragging ? 'var(--color-accent-subtle, var(--color-surface-raised))' : 'var(--color-surface-raised)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginBottom: 4 }}>
                  Sleep een afbeelding hierheen
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
                  of klik om te selecteren
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
              </div>
            )}
          </div>

          {/* Niche */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Niche *</label>
            <select value={niche} onChange={e => setNiche(e.target.value)} style={inp}>
              {MARKETING_NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>

          {/* Overlay text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Overlay tekst <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optioneel)</span></label>
            <textarea
              value={overlayText}
              onChange={e => setOverlayText(e.target.value)}
              rows={2}
              placeholder='bijv. "In 1 dag een nieuw dak — gratis dakschouw"'
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Notities <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optioneel)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder='bijv. "hook: hijskraan in 1 dag, doelgroep: 50+ eigenaar, periode: mrt–apr"'
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Stats */}
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink)', marginBottom: 10 }}>
              Meta statistieken
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <NumInput label="Spend"       name="spend"       value={spend}       onChange={setSpend}       prefix="€" />
              <NumInput label="Impressions" name="impressions"  value={impressions} onChange={setImpressions} />
              <NumInput label="CTR"         name="ctr"         value={ctr}         onChange={setCtr}         prefix="%" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <NumInput label="CPL"         name="cpl"         value={cpl}         onChange={setCpl}         prefix="€" />
              <NumInput label="Leads"       name="leads"       value={leads}       onChange={setLeads}       />
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
            {saving ? 'Uploaden…' : 'Winner toevoegen'}
          </button>
        </div>

      </div>
    </div>
  )
}
