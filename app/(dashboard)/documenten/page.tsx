'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const NL_MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
]

const MIME_LABELS: Record<string, string> = {
  'application/pdf':    'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
}

interface Doc {
  id:              string
  filename:        string
  storage_path:    string
  file_size_bytes: number | null
  mime_type:       string | null
  month:           string
  category:        string
  title:           string | null
  uploaded_at:     string
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${NL_MONTHS[parseInt(m) - 1]} ${y}`
}

function fmtSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)    return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function FileIcon({ mime }: { mime: string | null }) {
  const isPdf = mime === 'application/pdf'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: 'var(--radius-sm)', flexShrink: 0,
      background: isPdf ? '#f8524922' : '#58a6ff22',
      fontSize: 'var(--font-size-2xs)', fontWeight: 700,
      color: isPdf ? '#f85149' : '#58a6ff',
      letterSpacing: '0.02em',
    }}>
      {MIME_LABELS[mime ?? ''] ?? 'DOC'}
    </span>
  )
}

// ── Upload modal ──────────────────────────────────────────────────────────────

function UploadModal({
  file,
  onClose,
  onUploaded,
}: {
  file: File
  onClose: () => void
  onUploaded: (doc: Doc) => void
}) {
  const [month, setMonth]   = useState(currentYM)
  const [title, setTitle]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function upload() {
    setSaving(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('month', month)
    if (title.trim()) fd.append('title', title.trim())

    const r = await fetch('/api/documents', { method: 'POST', body: fd })
    setSaving(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError(j.error ?? 'Uploaden mislukt')
      return
    }
    onUploaded(await r.json())
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', width: '100%', boxSizing: 'border-box',
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-ink)', fontSize: 'var(--font-size-sm)', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-2xs)', fontWeight: 600,
    color: 'var(--color-ink-faint)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 4, display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            Document uploaden
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* File preview */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <FileIcon mime={file.type} />
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 2 }}>{fmtSize(file.size)}</div>
            </div>
          </div>

          {/* Month */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Maand *</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inputStyle} />
          </div>

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Titel (optioneel)</label>
            <input
              type="text" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={file.name}
              style={inputStyle}
            />
          </div>

          {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}
        </div>

        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px', background: 'none',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)',
            }}
          >
            Annuleren
          </button>
          <button
            onClick={upload} disabled={saving}
            style={{
              padding: '7px 16px', background: 'var(--color-accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)',
              cursor: saving ? 'default' : 'pointer',
              fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Uploaden…' : 'Uploaden'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Month section ──────────────────────────────────────────────────────────────

function MonthSection({
  month,
  docs,
  defaultOpen,
  onDelete,
}: {
  month: string
  docs: Doc[]
  defaultOpen: boolean
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(doc: Doc) {
    if (!confirm(`"${doc.title || doc.filename}" verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return
    setDeleting(doc.id)
    await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
    setDeleting(null)
    onDelete(doc.id)
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 'var(--font-size-xs)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
            display: 'inline-block',
            color: 'var(--color-ink-faint)',
          }}>▶</span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            {fmtMonth(month)}
          </span>
          <span style={{
            fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '1px 8px',
          }}>
            {docs.length} {docs.length === 1 ? 'document' : 'documenten'}
          </span>
        </div>
      </button>

      {/* Rows */}
      {open && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          {docs.map((doc, i) => (
            <div
              key={doc.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                borderBottom: i < docs.length - 1 ? '1px solid var(--color-border-subtle)' : undefined,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-raised)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}
            >
              <FileIcon mime={doc.mime_type} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {doc.title || doc.filename}
                </div>
                <div style={{
                  fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)',
                  marginTop: 2, display: 'flex', gap: 8,
                }}>
                  <span>{fmtSize(doc.file_size_bytes)}</span>
                  <span>·</span>
                  <span>{fmtDate(doc.uploaded_at)}</span>
                  {doc.title && doc.title !== doc.filename && (
                    <>
                      <span>·</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                        {doc.filename}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <a
                  href={`/api/documents/${doc.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '5px 12px',
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)', fontWeight: 500,
                    color: 'var(--color-ink-muted)',
                    textDecoration: 'none', cursor: 'pointer',
                    display: 'inline-block',
                  }}
                >
                  Open
                </a>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deleting === doc.id}
                  style={{
                    padding: '5px 12px', background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)', fontWeight: 500,
                    color: deleting === doc.id ? 'var(--color-ink-faint)' : 'var(--color-critical)',
                    cursor: deleting === doc.id ? 'default' : 'pointer',
                  }}
                >
                  {deleting === doc.id ? '…' : 'Verwijder'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DocumentenPage() {
  const { data: rawDocs, isLoading, mutate } = useSWR<Doc[]>('/api/documents', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  })

  const docs = Array.isArray(rawDocs) ? rawDocs : []

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragging,    setDragging]    = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Group docs by month
  const byMonth = new Map<string, Doc[]>()
  for (const doc of docs) {
    if (!byMonth.has(doc.month)) byMonth.set(doc.month, [])
    byMonth.get(doc.month)!.push(doc)
  }
  const months = [...byMonth.keys()]  // already sorted desc from API

  const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx'])

  function validateFile(file: File): string | null {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXT.has(ext)) return 'Alleen PDF, DOC en DOCX toegestaan'
    if (file.size > 50 * 1024 * 1024) return 'Bestand te groot (max 50 MB)'
    return null
  }

  function pickFile(file: File) {
    const err = validateFile(file)
    if (err) { alert(err); return }
    setPendingFile(file)
  }

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) pickFile(file)
    e.target.value = ''
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) pickFile(file)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setDragging(false), [])

  function handleUploaded(doc: Doc) {
    mutate(prev => [doc, ...(prev ?? [])], false)
    setPendingFile(null)
  }

  function handleDelete(id: string) {
    mutate(prev => (prev ?? []).filter(d => d.id !== id), false)
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
          Documenten
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
          Alle business documenten per maand · Meta analyses, agendas, profit sheets
        </p>
      </div>

      {/* Upload area */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: '28px 20px', marginBottom: 28, cursor: 'pointer',
          border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-xl)',
          background: dragging ? 'var(--color-accent)11' : 'var(--color-surface)',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <div style={{ fontSize: 28, lineHeight: 1 }}>📁</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-ink)' }}>
            Sleep een bestand hierheen of klik om te uploaden
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>
            PDF, DOC, DOCX · max 50 MB
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />

      {/* Documents */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
          Laden…
        </div>
      ) : months.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px',
          color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-lg)',
        }}>
          Nog geen documenten. Upload je eerste document hierboven.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {months.map((month, i) => (
            <MonthSection
              key={month}
              month={month}
              docs={byMonth.get(month)!}
              defaultOpen={i === 0}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Upload modal */}
      {pendingFile && (
        <UploadModal
          file={pendingFile}
          onClose={() => setPendingFile(null)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  )
}
