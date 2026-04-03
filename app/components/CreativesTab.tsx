'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dbGet, dbSet, dbSubscribe } from '../../lib/db'

const DB_KEY = 'bouwcheck_creatives_v1'
const BUCKET = 'creatives'

const ANGLES = ['Prijs (m²)', 'Prijs (totaal)', 'Urgentie', 'Social proof', 'Emotie', 'Voor/Na']
const STATUSES = ['Testing', 'Winning', 'Fatigue', 'Dead'] as const
type Status = typeof STATUSES[number]

const STATUS_COLOR: Record<Status, { bg: string; color: string; border: string }> = {
  Testing:  { bg: '#1a2744', color: '#60a5fa', border: '#1e3a5f' },
  Winning:  { bg: '#0d2d1f', color: '#34d399', border: '#134e34' },
  Fatigue:  { bg: '#2d1f0d', color: '#fb923c', border: '#5a3010' },
  Dead:     { bg: '#1a1a1a', color: '#6b7280', border: '#2d2d2d' },
}

interface Creative {
  id: string
  name: string
  description: string
  angles: string[]
  status: Status
  ctr: string
  cpl: string
  spend: string
  note: string
  imageUrl: string
  createdAt: string
}

const EMPTY: Omit<Creative, 'id' | 'createdAt' | 'imageUrl'> = {
  name: '', description: '', angles: [], status: 'Testing', ctr: '', cpl: '', spend: '', note: '',
}

export default function CreativesTab() {
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [filter, setFilter] = useState<Status | 'All'>('All')
  const [modal, setModal] = useState<{ open: boolean; editing: Creative | null }>({ open: false, editing: null })
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load + realtime
  useEffect(() => {
    dbGet(DB_KEY).then((v: Creative[] | null) => { if (v) setCreatives(v) })
    const ch = dbSubscribe([DB_KEY], (_k, v) => setCreatives(v))
    return () => { ch.unsubscribe() }
  }, [])

  function save(updated: Creative[]) {
    setCreatives(updated)
    dbSet(DB_KEY, updated)
  }

  function openAdd() {
    setForm({ ...EMPTY })
    setImageFile(null)
    setImagePreview('')
    setModal({ open: true, editing: null })
  }

  function openEdit(c: Creative) {
    setForm({ name: c.name, description: c.description, angles: c.angles, status: c.status, ctr: c.ctr, cpl: c.cpl, spend: c.spend, note: c.note })
    setImageFile(null)
    setImagePreview(c.imageUrl)
    setModal({ open: true, editing: c })
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  function toggleAngle(angle: string) {
    setForm(prev => ({
      ...prev,
      angles: prev.angles.includes(angle) ? prev.angles.filter(a => a !== angle) : [...prev.angles, angle],
    }))
  }

  async function handleSubmit() {
    if (!form.name.trim()) return
    setUploading(true)

    let imageUrl = modal.editing?.imageUrl ?? ''

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, imageFile, { upsert: true })
      if (error) {
        alert('Upload mislukt: ' + error.message)
        setUploading(false)
        return
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      imageUrl = urlData.publicUrl
    }

    if (modal.editing) {
      const updated = creatives.map(c => c.id === modal.editing!.id ? { ...c, ...form, imageUrl } : c)
      save(updated)
    } else {
      const newCreative: Creative = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), imageUrl, ...form }
      save([newCreative, ...creatives])
    }

    setUploading(false)
    setModal({ open: false, editing: null })
  }

  function handleDelete(id: string) {
    save(creatives.filter(c => c.id !== id))
    setDeleteConfirm(null)
  }

  const filtered = filter === 'All' ? creatives : creatives.filter(c => c.status === filter)
  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: creatives.filter(c => c.status === s).length }), {} as Record<Status, number>)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Creatives</h1>
          <p style={{ fontSize: 12, color: '#4a5568', marginTop: 4 }}>Ad library — {creatives.length} creatives</p>
        </div>
        <button onClick={openAdd} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nieuwe creative
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['All', ...STATUSES] as const).map(s => {
          const active = filter === s
          const col = s !== 'All' ? STATUS_COLOR[s] : null
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                background: active ? (col?.bg ?? '#1a1a2e') : 'transparent',
                color: active ? (col?.color ?? '#e2e8f0') : '#4a5568',
                borderColor: active ? (col?.border ?? '#252540') : '#1a1a2e',
              }}
            >
              {s} {s !== 'All' && <span style={{ opacity: 0.7 }}>({counts[s]})</span>}
              {s === 'All' && <span style={{ opacity: 0.7 }}> ({creatives.length})</span>}
            </button>
          )
        })}
      </div>

      {/* Gallery grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#2d3748', fontSize: 14 }}>
          {filter === 'All' ? 'Upload je eerste creative' : `Geen ${filter} creatives`}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(c => {
            const sc = STATUS_COLOR[c.status]
            return (
              <div key={c.id} style={{ background: '#111118', border: '1px solid #1a1a2e', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                {/* Image */}
                <div style={{ position: 'relative', aspectRatio: '1/1', background: '#0d0d15', cursor: 'pointer' }} onClick={() => openEdit(c)}>
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d3748', fontSize: 12 }}>Geen afbeelding</div>
                  )}
                  {/* Status badge overlay */}
                  <div style={{ position: 'absolute', top: 10, right: 10, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    {c.status}
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{c.name}</div>
                  {c.description && <div style={{ fontSize: 12, color: '#6b7280' }}>{c.description}</div>}

                  {/* Angles */}
                  {c.angles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {c.angles.map(a => (
                        <span key={a} style={{ background: '#1a1a2e', color: '#818cf8', border: '1px solid #252540', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>{a}</span>
                      ))}
                    </div>
                  )}

                  {/* Metrics */}
                  {(c.ctr || c.cpl || c.spend) && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      {c.ctr && <div><div style={{ fontSize: 10, color: '#4a5568' }}>CTR</div><div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{c.ctr}%</div></div>}
                      {c.cpl && <div><div style={{ fontSize: 10, color: '#4a5568' }}>CPL</div><div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>€{c.cpl}</div></div>}
                      {c.spend && <div><div style={{ fontSize: 10, color: '#4a5568' }}>Spend</div><div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>€{c.spend}</div></div>}
                    </div>
                  )}

                  {c.note && <div style={{ fontSize: 11, color: '#4a5568', fontStyle: 'italic', marginTop: 2 }}>"{c.note}"</div>}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                    <button onClick={() => openEdit(c)} style={{ flex: 1, background: '#1a1a2e', color: '#a0aec0', border: '1px solid #252540', borderRadius: 6, padding: '6px 0', fontSize: 12, cursor: 'pointer' }}>Bewerken</button>
                    {deleteConfirm === c.id ? (
                      <>
                        <button onClick={() => handleDelete(c.id)} style={{ flex: 1, background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', borderRadius: 6, padding: '6px 0', fontSize: 12, cursor: 'pointer' }}>Bevestig</button>
                        <button onClick={() => setDeleteConfirm(null)} style={{ background: 'transparent', color: '#4a5568', border: 'none', padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>✕</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirm(c.id)} style={{ background: 'transparent', color: '#4a5568', border: '1px solid #1a1a2e', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>🗑</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#111118', border: '1px solid #1a1a2e', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>{modal.editing ? 'Bewerken' : 'Nieuwe creative'}</h2>
              <button onClick={() => setModal({ open: false, editing: null })} style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Image upload */}
              <div>
                <label style={labelStyle}>Afbeelding</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{ border: '2px dashed #252540', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d15' }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ color: '#4a5568', fontSize: 13, textAlign: 'center', padding: 20 }}>Klik om afbeelding te uploaden</div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
              </div>

              {/* Name */}
              <div>
                <label style={labelStyle}>Naam *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="bijv. Aanbouw lente actie v1" style={inputStyle} />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Omschrijving</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Korte beschrijving van de creative" style={inputStyle} />
              </div>

              {/* Angles */}
              <div>
                <label style={labelStyle}>Angles</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ANGLES.map(a => {
                    const selected = form.angles.includes(a)
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAngle(a)}
                        style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                          background: selected ? '#312e81' : '#0d0d15',
                          color: selected ? '#818cf8' : '#4a5568',
                          border: `1px solid ${selected ? '#4338ca' : '#252540'}`,
                        }}
                      >
                        {a}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={labelStyle}>Status</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STATUSES.map(s => {
                    const active = form.status === s
                    const sc = STATUS_COLOR[s]
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, status: s }))}
                        style={{
                          flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700,
                          background: active ? sc.bg : 'transparent',
                          color: active ? sc.color : '#4a5568',
                          border: `1px solid ${active ? sc.border : '#1a1a2e'}`,
                        }}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>CTR %</label>
                  <input value={form.ctr} onChange={e => setForm(p => ({ ...p, ctr: e.target.value }))} placeholder="2.4" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CPL €</label>
                  <input value={form.cpl} onChange={e => setForm(p => ({ ...p, cpl: e.target.value }))} placeholder="18" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Spend €</label>
                  <input value={form.spend} onChange={e => setForm(p => ({ ...p, spend: e.target.value }))} placeholder="250" style={inputStyle} />
                </div>
              </div>

              {/* Note */}
              <div>
                <label style={labelStyle}>Notitie</label>
                <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="Observaties, wat werkt, wat niet..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={uploading || !form.name.trim()}
                style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer', opacity: !form.name.trim() ? 0.5 : 1, marginTop: 4 }}
              >
                {uploading ? 'Uploaden...' : modal.editing ? 'Opslaan' : 'Creative toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }
const inputStyle: React.CSSProperties = { width: '100%', background: '#0d0d15', border: '1px solid #1a1a2e', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
