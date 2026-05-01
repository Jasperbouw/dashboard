'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

const fetcher  = (url: string) => fetch(url).then(r => r.json())
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 30_000 } as const

// ── Types ────────────────────────────────────────────────────────────────────

interface MetaSpendRow {
  id:         string
  year_month: string
  amount_eur: number
  notes:      string | null
  updated_at: string
}

interface RevenueEntry {
  id:               string
  contractor_id:    string
  entry_date:       string
  period_start:     string | null
  period_end:       string | null
  type:             string
  niche:            string | null
  amount:           number
  description:      string | null
  invoice_number:   string | null
  payment_status:   string
  paid_at:          string | null
  notes:            string | null
  contractor:       { name: string; niche: string } | null
}

interface ContractorOption {
  id:    string
  name:  string
  niche: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  ad_budget:             'Ad Budget',
  retainer_fee:          'Retainer fee',
  commission_percentage: 'Commissie %',
  commission_flat:       'Commissie vast',
  other:                 'Overig',
}

const TYPE_COLOR: Record<string, string> = {
  ad_budget:             '#14b8a6',
  retainer_fee:          '#58a6ff',
  commission_percentage: '#3fb950',
  commission_flat:       '#f59e0b',
  other:                 '#484f58',
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  paid:    { color: '#3fb950', bg: '#0d281822', label: 'Betaald'   },
  open:    { color: '#f59e0b', bg: '#271d0522', label: 'Open'      },
  overdue: { color: '#f85149', bg: '#2d111722', label: 'Te laat'   },
}

const PERIOD_OPTIONS = [
  { value: 'mtd',   label: 'Deze maand'    },
  { value: 'qtd',   label: 'Dit kwartaal'  },
  { value: 'ytd',   label: 'Dit jaar'      },
  { value: '6m',    label: 'Afgelopen 6 maanden' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function periodFromDate(period: string): string {
  const now   = new Date()
  const y     = now.getFullYear()
  const m     = now.getMonth()
  if (period === 'mtd') return `${y}-${String(m + 1).padStart(2, '0')}-01`
  if (period === 'qtd') return `${y}-${String(Math.floor(m / 3) * 3 + 1).padStart(2, '0')}-01`
  if (period === 'ytd') return `${y}-01-01`
  // 6m
  const d = new Date(y, m - 5, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// ── Entry modal ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  contractor_id:  '',
  entry_date:     today(),
  period_start:   '',
  period_end:     '',
  type:           'ad_budget',
  niche:          '',
  amount:         '',
  description:    '',
  invoice_number: '',
  payment_status: 'paid',
  notes:          '',
}

function EntryModal({
  contractors, niches, editEntry, defaultContractorId,
  onSaved, onSaveAndNew, onClose,
}: {
  contractors:         ContractorOption[]
  niches:              string[]
  editEntry:           RevenueEntry | null
  defaultContractorId: string
  onSaved:     (e: RevenueEntry) => void
  onSaveAndNew:(contractorId: string) => void
  onClose:     () => void
}) {
  const [form, setForm]           = useState(() => editEntry
    ? {
        contractor_id:  editEntry.contractor_id,
        entry_date:     editEntry.entry_date,
        period_start:   editEntry.period_start  ?? '',
        period_end:     editEntry.period_end    ?? '',
        type:           editEntry.type,
        niche:          editEntry.niche         ?? '',
        amount:         String(editEntry.amount),
        description:    editEntry.description   ?? '',
        invoice_number: editEntry.invoice_number ?? '',
        payment_status: editEntry.payment_status,
        notes:          editEntry.notes         ?? '',
      }
    : { ...EMPTY_FORM, contractor_id: defaultContractorId }
  )
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [nicheList, setNicheList]   = useState(niches)
  const [newNiche, setNewNiche]     = useState('')
  const [addingNiche, setAddingNiche] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function addNiche() {
    if (!newNiche.trim()) return
    await fetch('/api/revenue/niches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newNiche.trim() }),
    })
    const n = newNiche.trim().toLowerCase()
    setNicheList(l => [...l, n])
    set('niche', n)
    setNewNiche('')
    setAddingNiche(false)
  }

  async function submit(andNew = false) {
    if (!form.entry_date || !form.type || !form.amount) {
      setError('Vul alle verplichte velden in')
      return
    }
    setSaving(true)
    setError('')

    const method = editEntry ? 'PUT' : 'POST'
    const url    = editEntry ? `/api/revenue/${editEntry.id}` : '/api/revenue'
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, contractor_id: form.contractor_id || null, amount: Number(form.amount) }),
    })
    setSaving(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError(j.error ?? 'Opslaan mislukt')
      return
    }
    const saved = await r.json()
    if (andNew) {
      onSaveAndNew(form.contractor_id)
    } else {
      onSaved(saved)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', width: '100%', boxSizing: 'border-box',
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-ink)', fontSize: 'var(--font-size-sm)',
    outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-2xs)', fontWeight: 600,
    color: 'var(--color-ink-faint)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 4, display: 'block',
  }
  const fieldStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 4,
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            {editEntry ? 'Entry bewerken' : 'Nieuwe entry'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Row 1: Contractor + Datum */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Contractor</label>
              <select value={form.contractor_id} onChange={e => set('contractor_id', e.target.value)} style={inputStyle}>
                <option value="">— Geen contractor (legacy/eenmalig)</option>
                {contractors.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Datum *</label>
              <input type="date" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Row 2: Type + Bedrag */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Bedrag (€) *</label>
              <input
                ref={amountRef}
                type="number" min="0" step="0.01"
                value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 3: Niche */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Niche</label>
            {addingNiche ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  autoFocus type="text" value={newNiche}
                  onChange={e => setNewNiche(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addNiche(); if (e.key === 'Escape') setAddingNiche(false) }}
                  placeholder="Nieuwe niche naam"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={addNiche} style={{ padding: '7px 12px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-xs)', flexShrink: 0 }}>Voeg toe</button>
                <button onClick={() => setAddingNiche(false)} style={{ padding: '7px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-faint)', flexShrink: 0, fontSize: 'var(--font-size-xs)' }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={form.niche} onChange={e => set('niche', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  <option value="">— Geen niche</option>
                  {nicheList.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={() => setAddingNiche(true)} style={{ padding: '7px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', flexShrink: 0, fontSize: 'var(--font-size-xs)' }} title="Nieuwe niche">+</button>
              </div>
            )}
          </div>

          {/* Row 4: Periode */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Periode start</label>
              <input type="date" value={form.period_start} onChange={e => set('period_start', e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Periode eind</label>
              <input type="date" value={form.period_end} onChange={e => set('period_end', e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Row 5: Beschrijving + Factuurnummer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Beschrijving</label>
              <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="bijv. 200 leads bouw" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Factuurnummer</label>
              <input type="text" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Row 6: Status */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Status</label>
            <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)} style={inputStyle}>
              <option value="paid">Betaald</option>
              <option value="open">Open</option>
              <option value="overdue">Te laat</option>
            </select>
          </div>

          {/* Notes */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Notities</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>

          {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0,
        }}>
          {!editEntry && (
            <button
              onClick={() => submit(true)} disabled={saving}
              style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}
            >
              Sla op + nieuwe
            </button>
          )}
          <button
            onClick={() => submit(false)} disabled={saving}
            style={{ padding: '7px 16px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Opslaan…' : editEntry ? 'Opslaan' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Meta spend section ───────────────────────────────────────────────────────

const NL_MONTHS_LONG = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']

function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function MetaSpendSection() {
  const [rows, setRows]       = useState<MetaSpendRow[]>([])
  const [month, setMonth]     = useState(currentYM)
  const [amount, setAmount]   = useState('')
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch('/api/revenue/meta-spend')
      .then(r => r.ok ? r.json() : [])
      .then(setRows)
  }, [])

  // Prefill form when switching months
  useEffect(() => {
    const existing = rows.find(r => r.year_month.slice(0, 7) === month)
    setAmount(existing ? String(existing.amount_eur) : '')
    setNotes(existing?.notes ?? '')
  }, [month, rows])

  async function save() {
    if (!amount) { setError('Vul een bedrag in'); return }
    setSaving(true); setError('')
    const r = await fetch('/api/revenue/meta-spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year_month: month, amount_eur: Number(amount), notes }),
    })
    setSaving(false)
    if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? 'Opslaan mislukt'); return }
    const saved: MetaSpendRow = await r.json()
    setRows(prev => {
      const idx = prev.findIndex(row => row.year_month.slice(0, 7) === month)
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n }
      return [saved, ...prev].sort((a, b) => b.year_month.localeCompare(a.year_month))
    })
  }

  function fmtMonth(ym: string) {
    const [y, m] = ym.slice(0, 7).split('-')
    return `${NL_MONTHS_LONG[parseInt(m) - 1]} ${y}`
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--color-ink)', fontSize: 'var(--font-size-sm)', outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block',
  }

  return (
    <div style={{
      marginTop: 36,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
          Meta Ad Spend
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
          Totale Meta Business Manager uitgaven per maand
        </span>
      </div>

      {/* Input form */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>Maand</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>Totaal uitgegeven (€) *</label>
          <input
            type="number" min="0" step="0.01"
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0"
            style={{ ...inputStyle, width: 160 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
          <label style={labelStyle}>Notities</label>
          <input
            type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Optioneel"
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <button
          onClick={save} disabled={saving}
          style={{
            padding: '7px 18px', background: 'var(--color-accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'default' : 'pointer',
            fontSize: 'var(--font-size-sm)', fontWeight: 500, opacity: saving ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {saving ? 'Opslaan…' : 'Opslaan'}
        </button>
        {error && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)', alignSelf: 'center' }}>{error}</span>}
      </div>

      {/* Historical list */}
      {rows.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Maand', 'Bedrag', 'Notities', 'Bijgewerkt'].map(h => (
                  <th key={h} style={{
                    padding: '7px 20px', textAlign: h === 'Bedrag' ? 'right' : 'left',
                    fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                    color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-raised)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                >
                  <td style={{ padding: '9px 20px', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {fmtMonth(row.year_month)}
                  </td>
                  <td style={{ padding: '9px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {fmtEur(Number(row.amount_eur))}
                  </td>
                  <td style={{ padding: '9px 20px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {row.notes ?? '—'}
                  </td>
                  <td style={{ padding: '9px 20px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', borderBottom: '1px solid var(--color-border-subtle)', whiteSpace: 'nowrap' }}>
                    {new Date(row.updated_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const ytdFrom = periodFromDate('ytd')

  const { data: rawEntries,     isLoading,    mutate: mutateEntries } =
    useSWR<RevenueEntry[]>(`/api/revenue?from_date=${ytdFrom}`, fetcher, SWR_OPTS)
  const { data: rawContractors } =
    useSWR<ContractorOption[]>('/api/contractors', fetcher, SWR_OPTS)
  const { data: rawNiches } =
    useSWR<string[]>('/api/revenue/niches', fetcher, SWR_OPTS)

  const entries     = Array.isArray(rawEntries) ? rawEntries : []
  const niches      = Array.isArray(rawNiches)  ? rawNiches  : []
  const contractors = Array.isArray(rawContractors)
    ? rawContractors.map((c: { id: string; name: string; niche: string }) => ({
        id: c.id, name: c.name, niche: c.niche,
      }))
    : []
  const loading = isLoading

  // Filters
  const [filterContractor, setFilterContractor] = useState('')
  const [filterType, setFilterType]             = useState('')
  const [filterNiche, setFilterNiche]           = useState('')
  const [filterPeriod, setFilterPeriod]         = useState('ytd')

  // Sort
  const [sortCol, setSortCol] = useState<'entry_date' | 'amount'>('entry_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Modal
  const [modalOpen, setModalOpen]         = useState(false)
  const [editEntry, setEditEntry]         = useState<RevenueEntry | null>(null)
  const [defaultCont, setDefaultCont]     = useState('')

  // Action menus
  const [openMenu,  setOpenMenu]  = useState<string | null>(null)
  const [menuEntry, setMenuEntry] = useState<RevenueEntry | null>(null)
  const [menuPos,   setMenuPos]   = useState<{ top: number; right: number } | null>(null)

  function openContextMenu(ev: React.MouseEvent, entry: RevenueEntry) {
    ev.stopPropagation()
    if (openMenu === entry.id) {
      setOpenMenu(null); setMenuEntry(null); setMenuPos(null)
      return
    }
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setMenuEntry(entry)
    setOpenMenu(entry.id)
  }

  // Close menu on outside click
  useEffect(() => {
    function handler() { setOpenMenu(null); setMenuEntry(null); setMenuPos(null) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  async function deleteEntry(id: string) {
    if (!confirm('Entry verwijderen? Dit kan niet ongedaan gemaakt worden.')) return
    await fetch(`/api/revenue/${id}`, { method: 'DELETE' })
    mutateEntries(prev => (prev ?? []).filter(e => e.id !== id), false)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now    = new Date()
  const y      = now.getFullYear()
  const m      = now.getMonth()
  const mtdStr = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const qtdStr = `${y}-${String(Math.floor(m / 3) * 3 + 1).padStart(2, '0')}-01`
  const ytdStr = `${y}-01-01`

  const ytdCount  = entries.filter(e => e.entry_date >= ytdStr).length
  const mtdCount  = entries.filter(e => e.entry_date >= mtdStr).length
  const openCount = entries.filter(e => e.payment_status === 'open' || e.payment_status === 'overdue').length
  const lastEntry = entries.length > 0
    ? entries.reduce((a, b) => a.entry_date > b.entry_date ? a : b).entry_date
    : null

  // ── Filtered + sorted ──────────────────────────────────────────────────────
  const fromDate = periodFromDate(filterPeriod)
  const filtered = entries
    .filter(e => {
      if (filterContractor && e.contractor_id !== filterContractor) return false
      if (filterType && e.type !== filterType) return false
      if (filterNiche && e.niche !== filterNiche) return false
      if (e.entry_date < fromDate) return false
      return true
    })
    .sort((a, b) => {
      const va = sortCol === 'amount' ? Number(a.amount) : a.entry_date
      const vb = sortCol === 'amount' ? Number(b.amount) : b.entry_date
      if (va < vb) return sortDir === 'asc' ? -1 :  1
      if (va > vb) return sortDir === 'asc' ?  1 : -1
      return 0
    })

  const filteredTotal    = filtered.reduce((s, e) => s + Number(e.amount), 0)
  const adBudgetTotal    = filtered.filter(e => e.type === 'ad_budget').reduce((s, e) => s + Number(e.amount), 0)
  const omzetTotal       = filteredTotal - adBudgetTotal

  function toggleSort(col: 'entry_date' | 'amount') {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', fontSize: 'var(--font-size-xs)',
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-ink)', cursor: 'pointer', outline: 'none',
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'left',
    fontSize: 'var(--font-size-2xs)', fontWeight: 600,
    color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid var(--color-border-subtle)',
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
  }

  const thStyleNoSort: React.CSSProperties = { ...thStyle, cursor: 'default' }

  const tdStyle: React.CSSProperties = {
    padding: '9px 12px',
    borderBottom: '1px solid var(--color-border-subtle)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-ink)',
    verticalAlign: 'middle',
  }

  const SortArrow = ({ col }: { col: string }) =>
    sortCol === col
      ? <span style={{ marginLeft: 4, opacity: 0.7 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
      : null

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
          Omzet
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
          Alle inkomende entries · ad budget, retainer, commissie
        </p>
      </div>

      {/* Hero stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Entries dit jaar',  value: ytdCount,  meta: `${y} totaal` },
          { label: 'Entries deze maand', value: mtdCount, meta: 'Lopende maand' },
          { label: 'Open / unpaid',     value: openCount, meta: 'Open of te laat', warn: openCount > 0 },
          { label: 'Laatste invoer',    value: lastEntry ? fmtDate(lastEntry) : '—', meta: 'Meest recente entry', str: true },
        ].map(s => (
          <div key={s.label} style={{
            padding: '16px', background: 'var(--color-surface)',
            border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{
              fontSize: s.str ? 'var(--font-size-xl)' : 'var(--font-size-2xl)',
              fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              color: s.warn ? 'var(--color-warning)' : 'var(--color-ink)',
            }}>
              {s.str ? s.value : s.value}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>{s.meta}</div>
          </div>
        ))}
      </div>

      {/* Filters + New button */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={filterContractor} onChange={e => setFilterContractor(e.target.value)} style={selectStyle}>
          <option value="">Alle contractors</option>
          {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
          <option value="">Alle types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select value={filterNiche} onChange={e => setFilterNiche(e.target.value)} style={selectStyle}>
          <option value="">Alle niches</option>
          {niches.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={selectStyle}>
          {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => { setEditEntry(null); setDefaultCont(filterContractor); setModalOpen(true) }}
          style={{
            padding: '7px 16px', background: 'var(--color-accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            fontSize: 'var(--font-size-sm)', fontWeight: 500,
          }}
        >
          + Nieuwe entry
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'auto',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
            Laden…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
            Geen entries gevonden
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle }} onClick={() => toggleSort('entry_date')}>
                  Datum <SortArrow col="entry_date" />
                </th>
                <th style={thStyleNoSort}>Contractor</th>
                <th style={thStyleNoSort}>Type</th>
                <th style={thStyleNoSort}>Niche</th>
                <th style={thStyleNoSort}>Beschrijving</th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort('amount')}>
                  Bedrag <SortArrow col="amount" />
                </th>
                <th style={thStyleNoSort}>Status</th>
                <th style={thStyleNoSort}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const ss = STATUS_STYLE[e.payment_status] ?? STATUS_STYLE.open
                return (
                  <tr key={e.id} style={{ transition: 'background 0.1s' }}
                    onMouseEnter={el => (el.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-raised)'}
                    onMouseLeave={el => (el.currentTarget as HTMLTableRowElement).style.background = ''}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {fmtDate(e.entry_date)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {e.contractor_id
                        ? <span style={{ fontWeight: 500 }}>{e.contractor?.name ?? '—'}</span>
                        : <span style={{ color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-xs)', fontStyle: 'italic' }}>Legacy/eenmalig</span>
                      }
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                        color: TYPE_COLOR[e.type] ?? '#fff',
                        background: `${TYPE_COLOR[e.type] ?? '#888'}22`,
                        whiteSpace: 'nowrap',
                      }}>
                        {TYPE_LABELS[e.type] ?? e.type}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>
                      {e.niche ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 220, color: 'var(--color-ink-muted)' }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description ?? ''}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {fmtEur(Number(e.amount))}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                        color: ss.color, background: ss.bg, whiteSpace: 'nowrap',
                      }}>
                        {ss.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, width: 40, textAlign: 'center' }}>
                      <button
                        onClick={ev => openContextMenu(ev, e)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16, padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer summary */}
      {!loading && filtered.length > 0 && (
        <div style={{
          marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)',
        }}>
          <span>{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'} getoond</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--color-ink)' }}>
              {fmtEur(filteredTotal)} totaal
            </span>
            {adBudgetTotal > 0 && (
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink-faint)' }}>
                {fmtEur(omzetTotal)} omzet · {fmtEur(adBudgetTotal)} ad budget pass-through
              </span>
            )}
          </div>
        </div>
      )}

      {/* Meta spend */}
      <MetaSpendSection />

      {/* Context menu — rendered outside table to avoid overflow clipping */}
      {openMenu && menuEntry && menuPos && (
        <div
          onClick={ev => ev.stopPropagation()}
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 500,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            minWidth: 140, overflow: 'hidden',
          }}
        >
          {([
            {
              label: 'Bewerken',
              action: () => { setEditEntry(menuEntry); setModalOpen(true); setOpenMenu(null); setMenuEntry(null) },
              danger: false,
            },
            {
              label: 'Verwijderen',
              action: () => { deleteEntry(menuEntry.id); setOpenMenu(null); setMenuEntry(null) },
              danger: true,
            },
          ] as const).map(item => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 'var(--font-size-xs)',
                color: item.danger ? 'var(--color-critical)' : 'var(--color-ink)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <EntryModal
          contractors={contractors}
          niches={niches}
          editEntry={editEntry}
          defaultContractorId={defaultCont}
          onSaved={saved => {
            mutateEntries(prev => {
              const list = prev ?? []
              const idx  = list.findIndex(e => e.id === saved.id)
              if (idx >= 0) { const n = [...list]; n[idx] = saved; return n }
              return [saved, ...list]
            }, false)
            setModalOpen(false)
            setEditEntry(null)
          }}
          onSaveAndNew={contractorId => {
            mutateEntries()  // revalidate after bulk add
            setEditEntry(null)
            setDefaultCont(contractorId)
            setModalOpen(false)
            setTimeout(() => setModalOpen(true), 0)
          }}
          onClose={() => { setModalOpen(false); setEditEntry(null) }}
        />
      )}
    </div>
  )
}
