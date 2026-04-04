'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dbGet, dbSet, dbSubscribe } from '../../lib/db'

const DB_KEY = 'bouwcheck_creatives_v1'
const FOLDERS_KEY = 'bouwcheck_creative_folders_v1'
const BUCKET = 'Creatives'

const ANGLES = ['Prijs (m²)', 'Prijs (totaal)', 'Urgentie', 'Social proof', 'Emotie', 'Voor/Na']
const STATUSES = ['Testing', 'Winning', 'Fatigue', 'Dead'] as const
type Status = typeof STATUSES[number]

const STATUS_COLOR: Record<Status, { bg: string; color: string; border: string }> = {
  Testing:  { bg: '#1a2744', color: '#60a5fa', border: '#1e3a5f' },
  Winning:  { bg: '#0d2d1f', color: '#34d399', border: '#134e34' },
  Fatigue:  { bg: '#2d1f0d', color: '#fb923c', border: '#5a3010' },
  Dead:     { bg: '#1a1a1a', color: '#6b7280', border: '#2d2d2d' },
}

interface Folder {
  id: string
  name: string
  createdAt: string
}

interface Creative {
  id: string
  folderId: string
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

const EMPTY_FORM = {
  name: '', description: '', angles: [] as string[], status: 'Testing' as Status, ctr: '', cpl: '', spend: '', note: '',
}

const DEFAULT_FOLDERS: Folder[] = [
  { id: 'aanbouw', name: 'Aanbouw', createdAt: new Date().toISOString() },
  { id: 'opbouw', name: 'Opbouw', createdAt: new Date().toISOString() },
  { id: 'renovatie', name: 'Renovatie', createdAt: new Date().toISOString() },
  { id: 'nieuwbouw', name: 'Nieuwbouw', createdAt: new Date().toISOString() },
]

export default function CreativesTab() {
  const [folders, setFolders] = useState<Folder[]>(DEFAULT_FOLDERS)
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [activeFolder, setActiveFolder] = useState<string>(DEFAULT_FOLDERS[0].id)
  const [filter, setFilter] = useState<Status | 'All'>('All')
  const [modal, setModal] = useState<{ open: boolean; editing: Creative | null }>({ open: false, editing: null })
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    dbGet(FOLDERS_KEY).then((v: Folder[] | null) => { if (v && v.length > 0) setFolders(v) })
    dbGet(DB_KEY).then((v: Creative[] | null) => { if (v) setCreatives(v) })
    const ch = dbSubscribe([DB_KEY, FOLDERS_KEY], (k, v) => {
      if (k === DB_KEY) setCreatives(v)
      if (k === FOLDERS_KEY) setFolders(v)
    })
    return () => { ch.unsubscribe() }
  }, [])

  function saveFolders(updated: Folder[]) {
    setFolders(updated)
    dbSet(FOLDERS_KEY, updated)
  }

  function saveCreatives(updated: Creative[]) {
    setCreatives(updated)
    dbSet(DB_KEY, updated)
  }

  function addFolder() {
    if (!newFolderName.trim()) return
    const f: Folder = { id: crypto.randomUUID(), name: newFolderName.trim(), createdAt: new Date().toISOString() }
    const updated = [...folders, f]
    saveFolders(updated)
    setActiveFolder(f.id)
    setNewFolderName('')
    setNewFolderMode(false)
  }

  function deleteFolder(id: string) {
    const updated = folders.filter(f => f.id !== id)
    saveFolders(updated)
    saveCreatives(creatives.filter(c => c.folderId !== id))
    if (activeFolder === id) setActiveFolder(updated[0]?.id ?? '')
    setDeleteFolderConfirm(null)
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM })
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
      if (error) { alert('Upload mislukt: ' + error.message); setUploading(false); return }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      imageUrl = urlData.publicUrl
    }

    if (modal.editing) {
      saveCreatives(creatives.map(c => c.id === modal.editing!.id ? { ...c, ...form, imageUrl } : c))
    } else {
      const newC: Creative = { id: crypto.randomUUID(), folderId: activeFolder, createdAt: new Date().toISOString(), imageUrl, ...form }
      saveCreatives([newC, ...creatives])
    }

    setUploading(false)
    setModal({ open: false, editing: null })
  }

  function handleDelete(id: string) {
    saveCreatives(creatives.filter(c => c.id !== id))
    setDeleteConfirm(null)
  }

  const folderCreatives = creatives.filter(c => c.folderId === activeFolder)
  const filtered = filter === 'All' ? folderCreatives : folderCreatives.filter(c => c.status === filter)
  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: folderCreatives.filter(c => c.status === s).length }), {} as Record<Status, number>)
  const currentFolder = folders.find(f => f.id === activeFolder)

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 56px)', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Folder sidebar ── */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid #1a1a2e', paddingRight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 0 12px 0', fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4a5568', textTransform: 'uppercase' }}>Mappen</div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {folders.map(f => {
            const count = creatives.filter(c => c.folderId === f.id).length
            const active = activeFolder === f.id
            return (
              <div key={f.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => { setActiveFolder(f.id); setFilter('All'); setDeleteFolderConfirm(null) }}
                  style={{
                    flex: 1, textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    background: active ? '#1a1a2e' : 'transparent',
                    color: active ? '#e2e8f0' : '#4a5568',
                    border: active ? '1px solid #252540' : '1px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                  }}
                >
                  <span>📁 {f.name}</span>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>{count}</span>
                </button>
                {active && deleteFolderConfirm === f.id ? (
                  <div style={{ display: 'flex', gap: 4, position: 'absolute', right: 4 }}>
                    <button onClick={() => deleteFolder(f.id)} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}>✓</button>
                    <button onClick={() => setDeleteFolderConfirm(null)} style={{ background: 'transparent', color: '#4a5568', border: 'none', padding: '2px 4px', fontSize: 10, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : active ? (
                  <button onClick={() => setDeleteFolderConfirm(f.id)} style={{ background: 'transparent', border: 'none', color: '#2d3748', fontSize: 12, cursor: 'pointer', padding: '4px' }}>🗑</button>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* New folder */}
        <div style={{ marginTop: 12, borderTop: '1px solid #1a1a2e', paddingTop: 12 }}>
          {newFolderMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') setNewFolderMode(false) }}
                placeholder="Mapnaam..."
                style={{ background: '#0d0d15', border: '1px solid #252540', borderRadius: 6, padding: '6px 8px', color: '#e2e8f0', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={addFolder} style={{ flex: 1, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}>Aanmaken</button>
                <button onClick={() => setNewFolderMode(false)} style={{ background: 'transparent', color: '#4a5568', border: '1px solid #1a1a2e', borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setNewFolderMode(true)} style={{ width: '100%', background: 'transparent', color: '#4a5568', border: '1px dashed #1a1a2e', borderRadius: 8, padding: '7px 0', fontSize: 12, cursor: 'pointer' }}>
              + Nieuwe map
            </button>
          )}
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, paddingLeft: 28, overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{currentFolder?.name ?? 'Creatives'}</h1>
            <p style={{ fontSize: 12, color: '#4a5568', marginTop: 4 }}>{folderCreatives.length} creatives</p>
          </div>
          <button onClick={openAdd} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Nieuwe creative
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['All', ...STATUSES] as const).map(s => {
            const active = filter === s
            const col = s !== 'All' ? STATUS_COLOR[s] : null
            const cnt = s === 'All' ? folderCreatives.length : counts[s]
            return (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                background: active ? (col?.bg ?? '#1a1a2e') : 'transparent',
                color: active ? (col?.color ?? '#e2e8f0') : '#4a5568',
                borderColor: active ? (col?.border ?? '#252540') : '#1a1a2e',
              }}>
                {s} <span style={{ opacity: 0.6 }}>({cnt})</span>
              </button>
            )
          })}
        </div>

        {/* Gallery */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#2d3748', fontSize: 14 }}>
            {filter === 'All' ? `Nog geen creatives in ${currentFolder?.name ?? 'deze map'}` : `Geen ${filter} creatives`}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {filtered.map(c => {
              const sc = STATUS_COLOR[c.status]
              return (
                <div key={c.id} style={{ background: '#111118', border: '1px solid #1a1a2e', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', aspectRatio: '1/1', background: '#0d0d15', cursor: 'pointer' }} onClick={() => openEdit(c)}>
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d3748', fontSize: 12 }}>Geen afbeelding</div>
                    )}
                    <div style={{ position: 'absolute', top: 10, right: 10, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                      {c.status}
                    </div>
                  </div>
                  <div style={{ padding: 10, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{c.name}</div>
                    {c.angles.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {c.angles.map(a => (
                          <span key={a} style={{ background: '#1a1a2e', color: '#818cf8', border: '1px solid #252540', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 600 }}>{a}</span>
                        ))}
                      </div>
                    )}
                    {(c.ctr || c.cpl || c.spend) && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {c.ctr && <div><div style={{ fontSize: 9, color: '#4a5568' }}>CTR</div><div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{c.ctr}%</div></div>}
                        {c.cpl && <div><div style={{ fontSize: 9, color: '#4a5568' }}>CPL</div><div style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>€{c.cpl}</div></div>}
                        {c.spend && <div><div style={{ fontSize: 9, color: '#4a5568' }}>Spend</div><div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>€{c.spend}</div></div>}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 6 }}>
                      <button onClick={() => openEdit(c)} style={{ flex: 1, background: '#1a1a2e', color: '#a0aec0', border: '1px solid #252540', borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}>Bewerken</button>
                      {c.imageUrl && <a href={c.imageUrl} download target="_blank" rel="noreferrer" style={{ background: 'transparent', color: '#4a5568', border: '1px solid #1a1a2e', borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>⬇</a>}
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
      </div>

      {/* ── Modal ── */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#111118', border: '1px solid #1a1a2e', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>{modal.editing ? 'Bewerken' : `Nieuwe creative — ${currentFolder?.name}`}</h2>
              <button onClick={() => setModal({ open: false, editing: null })} style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Afbeelding</label>
                <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #252540', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d15' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ color: '#4a5568', fontSize: 13, textAlign: 'center', padding: 20 }}>Klik om afbeelding te uploaden</div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
              </div>
              <div>
                <label style={labelStyle}>Naam *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="bijv. Aanbouw lente actie v1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Omschrijving</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Korte beschrijving" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Angles</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ANGLES.map(a => {
                    const selected = form.angles.includes(a)
                    return (
                      <button key={a} type="button" onClick={() => toggleAngle(a)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600, background: selected ? '#312e81' : '#0d0d15', color: selected ? '#818cf8' : '#4a5568', border: `1px solid ${selected ? '#4338ca' : '#252540'}` }}>
                        {a}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STATUSES.map(s => {
                    const active = form.status === s
                    const sc = STATUS_COLOR[s]
                    return (
                      <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))} style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700, background: active ? sc.bg : 'transparent', color: active ? sc.color : '#4a5568', border: `1px solid ${active ? sc.border : '#1a1a2e'}` }}>
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><label style={labelStyle}>CTR %</label><input value={form.ctr} onChange={e => setForm(p => ({ ...p, ctr: e.target.value }))} placeholder="2.4" style={inputStyle} /></div>
                <div><label style={labelStyle}>CPL €</label><input value={form.cpl} onChange={e => setForm(p => ({ ...p, cpl: e.target.value }))} placeholder="18" style={inputStyle} /></div>
                <div><label style={labelStyle}>Spend €</label><input value={form.spend} onChange={e => setForm(p => ({ ...p, spend: e.target.value }))} placeholder="250" style={inputStyle} /></div>
              </div>
              <div>
                <label style={labelStyle}>Notitie</label>
                <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="Observaties, wat werkt, wat niet..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <button onClick={handleSubmit} disabled={uploading || !form.name.trim()} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer', opacity: !form.name.trim() ? 0.5 : 1, marginTop: 4 }}>
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
