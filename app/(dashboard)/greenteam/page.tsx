'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 30_000 } as const

// ── Types ─────────────────────────────────────────────────────────────────────

interface GreenDeal {
  id:                          string
  client_name:                 string
  location:                    string | null
  closed_at:                   string
  status:                      string
  deal_value:                  number
  commission_pct:              number
  commission_amount:           number
  commission_received_amount:  number
  commission_received:         boolean
  product_thuisbatterij:       boolean
  product_warmtepomp:          boolean
  product_zonnepanelen:        boolean
  financing_warmtefonds:       boolean
  financing_eigen:             boolean
  financing_svn:               boolean
  lead_source:                 string | null
  notes:                       string | null
  created_at:                  string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function today() { return new Date().toISOString().slice(0, 10) }

function periodRange(period: string): { from: string; to: string } {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth()
  if (period === 'month') {
    return {
      from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      to:   new Date(y, m + 1, 0).toISOString().slice(0, 10),
    }
  }
  if (period === 'last') {
    const d = new Date(y, m - 1, 1)
    return {
      from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      to:   new Date(y, m, 0).toISOString().slice(0, 10),
    }
  }
  if (period === 'ytd') return { from: `${y}-01-01`, to: now.toISOString().slice(0, 10) }
  return { from: '2000-01-01', to: '2099-12-31' }
}

function productsLabel(d: GreenDeal): string {
  const parts: string[] = []
  if (d.product_thuisbatterij) parts.push('TB')
  if (d.product_warmtepomp)    parts.push('WP')
  if (d.product_zonnepanelen)  parts.push('ZP')
  return parts.join('+') || '—'
}

function financingLabel(d: GreenDeal): string {
  const parts: string[] = []
  if (d.financing_warmtefonds) parts.push('WF')
  if (d.financing_eigen)       parts.push('Eigen')
  if (d.financing_svn)         parts.push('SVn')
  return parts.join('+') || '—'
}

function commStatus(d: GreenDeal): 'open' | 'partial' | 'full' {
  const recv  = Number(d.commission_received_amount)
  const total = Number(d.commission_amount)
  if (recv <= 0) return 'open'
  if (recv >= total) return 'full'
  return 'partial'
}

// ── Form state type ───────────────────────────────────────────────────────────

interface FormState {
  client_name:           string
  location:              string
  closed_at:             string
  status:                string
  deal_value:            string
  commission_pct:        string
  product_thuisbatterij: boolean
  product_warmtepomp:    boolean
  product_zonnepanelen:  boolean
  financing_warmtefonds: boolean
  financing_eigen:       boolean
  financing_svn:         boolean
  lead_source:           string
  notes:                 string
}

const EMPTY_FORM: FormState = {
  client_name: '', location: '', closed_at: today(), status: 'akkoord',
  deal_value: '', commission_pct: '10',
  product_thuisbatterij: false, product_warmtepomp: false, product_zonnepanelen: false,
  financing_warmtefonds: false, financing_eigen: false, financing_svn: false,
  lead_source: '', notes: '',
}

// ── Deal modal ────────────────────────────────────────────────────────────────

function GreenDealModal({
  editDeal,
  onSaved,
  onClose,
}: {
  editDeal: GreenDeal | null
  onSaved:  (d: GreenDeal) => void
  onClose:  () => void
}) {
  const [form, setForm] = useState<FormState>(() => editDeal ? {
    client_name:           editDeal.client_name,
    location:              editDeal.location ?? '',
    closed_at:             editDeal.closed_at,
    status:                editDeal.status,
    deal_value:            String(editDeal.deal_value),
    commission_pct:        String(editDeal.commission_pct),
    product_thuisbatterij: editDeal.product_thuisbatterij,
    product_warmtepomp:    editDeal.product_warmtepomp,
    product_zonnepanelen:  editDeal.product_zonnepanelen,
    financing_warmtefonds: editDeal.financing_warmtefonds,
    financing_eigen:       editDeal.financing_eigen,
    financing_svn:         editDeal.financing_svn,
    lead_source:           editDeal.lead_source ?? '',
    notes:                 editDeal.notes ?? '',
  } : { ...EMPTY_FORM })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function setStr(k: keyof FormState, v: string)    { setForm(f => ({ ...f, [k]: v })) }
  function toggle(k: keyof FormState)               { setForm(f => ({ ...f, [k]: !f[k] })) }

  // Derived commission amount (deal_value × commission_pct / 100)
  const commAmount = (() => {
    const val = parseFloat(form.deal_value)
    const pct = parseFloat(form.commission_pct)
    return !isNaN(val) && !isNaN(pct) && val > 0 ? val * pct / 100 : 0
  })()

  async function submit() {
    if (!form.client_name || !form.closed_at || !form.deal_value || !form.commission_pct) {
      setError('Vul alle verplichte velden in'); return
    }
    if (commAmount <= 0) { setError('Commissie moet groter zijn dan €0'); return }
    setSaving(true); setError('')
    const method = editDeal ? 'PATCH' : 'POST'
    const url    = editDeal ? `/api/greenteam/${editDeal.id}` : '/api/greenteam'
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name:           form.client_name,
        location:              form.location || null,
        closed_at:             form.closed_at,
        status:                form.status,
        deal_value:            Number(form.deal_value),
        commission_pct:        Number(form.commission_pct),
        commission_amount:     commAmount,
        product_thuisbatterij: form.product_thuisbatterij,
        product_warmtepomp:    form.product_warmtepomp,
        product_zonnepanelen:  form.product_zonnepanelen,
        financing_warmtefonds: form.financing_warmtefonds,
        financing_eigen:       form.financing_eigen,
        financing_svn:         form.financing_svn,
        lead_source:           form.lead_source || null,
        notes:                 form.notes || null,
      }),
    })
    setSaving(false)
    if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? 'Opslaan mislukt'); return }
    onSaved(await r.json())
  }

  const inp: React.CSSProperties = {
    padding: '7px 10px', width: '100%', boxSizing: 'border-box',
    background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--color-ink)',
    fontSize: 'var(--font-size-sm)', outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 540, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
            {editDeal ? 'Deal bewerken' : 'GreenTeam deal toevoegen'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '72vh' }}>

          {/* Client + Locatie */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Klant naam *</label>
              <input type="text" value={form.client_name} onChange={e => setStr('client_name', e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Plaats</label>
              <input type="text" value={form.location} onChange={e => setStr('location', e.target.value)} placeholder="Amsterdam" style={inp} />
            </div>
          </div>

          {/* Datum + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Close datum *</label>
              <input type="date" value={form.closed_at} onChange={e => setStr('closed_at', e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Status</label>
              <select value={form.status} onChange={e => setStr('status', e.target.value)} style={inp}>
                <option value="akkoord">Akkoord</option>
                <option value="geannuleerd">Geannuleerd</option>
              </select>
            </div>
          </div>

          {/* Deal waarde + Comm % + afgeleid bedrag */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Deal waarde (€) *</label>
              <input type="number" min="0" step="100" value={form.deal_value} onChange={e => setStr('deal_value', e.target.value)} placeholder="15000" style={inp} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Comm. %</label>
              <input type="number" min="1" max="12" step="0.5" value={form.commission_pct} onChange={e => setStr('commission_pct', e.target.value)} style={inp} />
            </div>
          </div>
          {commAmount > 0 && (
            <div style={{ marginTop: -8, fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
              Commissie: <strong style={{ color: '#3fb950' }}>{fmtEur(commAmount)}</strong>
            </div>
          )}

          {/* Producten */}
          <div>
            <label style={lbl}>Producten</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                { key: 'product_thuisbatterij' as keyof FormState, label: 'Thuisbatterij' },
                { key: 'product_warmtepomp'    as keyof FormState, label: 'Warmtepomp' },
                { key: 'product_zonnepanelen'  as keyof FormState, label: 'Zonnepanelen' },
              ]).map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={form[key] as boolean} onChange={() => toggle(key)}
                    style={{ accentColor: '#3fb950', width: 14, height: 14, flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Financiering */}
          <div>
            <label style={lbl}>Financiering</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                { key: 'financing_warmtefonds' as keyof FormState, label: 'Warmtefonds' },
                { key: 'financing_eigen'       as keyof FormState, label: 'Eigen middelen' },
                { key: 'financing_svn'         as keyof FormState, label: 'SVn' },
              ]).map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 100, padding: '6px 10px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={form[key] as boolean} onChange={() => toggle(key)}
                    style={{ accentColor: '#58a6ff', width: 14, height: 14, flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Lead bron */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Lead bron (optioneel)</label>
            <input type="text" value={form.lead_source} onChange={e => setStr('lead_source', e.target.value)} placeholder="GreenTeam warm, eigen netwerk, referral, …" style={inp} />
          </div>

          {/* Notities */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Notities (optioneel)</label>
            <textarea value={form.notes} onChange={e => setStr('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>

          {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>Annuleren</button>
          <button onClick={submit} disabled={saving} style={{ padding: '7px 16px', background: '#3fb950', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : editDeal ? 'Opslaan' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row menu ──────────────────────────────────────────────────────────────────

function RowMenu({
  pos,
  onEdit,
  onDelete,
}: {
  pos:      { top: number; right: number }
  onEdit:   () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: pos.top, right: pos.right, zIndex: 500,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        minWidth: 130, overflow: 'hidden',
      }}
    >
      {([
        { label: 'Bewerken',   action: onEdit,   danger: false },
        { label: 'Verwijderen', action: onDelete, danger: true  },
      ] as const).map(item => (
        <button key={item.label} onClick={item.action}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: item.danger ? 'var(--color-critical)' : 'var(--color-ink)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirmModal({
  deal,
  deleting,
  onConfirm,
  onCancel,
}: {
  deal:      GreenDeal
  deleting:  boolean
  onConfirm: () => void
  onCancel:  () => void
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>Deal verwijderen?</span>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ margin: '0 0 16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)' }}>
            Weet je zeker dat je deze deal wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
          </p>
          <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: '#8b949e' }}>Klant</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-ink)' }}>{deal.client_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: '#8b949e' }}>Deal waarde</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink)' }}>{fmtEur(Number(deal.deal_value))}</span>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>Annuleren</button>
          <button onClick={onConfirm} disabled={deleting} style={{ padding: '7px 16px', background: 'var(--color-critical)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: deleting ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: deleting ? 0.7 : 1 }}>
            {deleting ? 'Verwijderen…' : 'Verwijderen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GreenTeamPage() {
  const { data: rawDeals, mutate } = useSWR<GreenDeal[]>('/api/greenteam', fetcher, SWR_OPTS)
  const deals = Array.isArray(rawDeals) ? rawDeals : []

  const [filterPeriod, setFilterPeriod] = useState('month')
  const [filterStatus, setFilterStatus] = useState('all')
  const [modal,        setModal]        = useState(false)
  const [editDeal,     setEditDeal]     = useState<GreenDeal | null>(null)
  const [menuId,       setMenuId]       = useState<string | null>(null)
  const [menuPos,      setMenuPos]      = useState<{ top: number; right: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GreenDeal | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  const [editingCommId,  setEditingCommId]  = useState<string | null>(null)
  const [editingCommAmt, setEditingCommAmt] = useState('')
  const [savingComm,     setSavingComm]     = useState(false)

  useEffect(() => {
    if (!menuId) return
    function close() { setMenuId(null); setMenuPos(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuId])

  function openMenu(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (menuId === id) { setMenuId(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setMenuId(id)
  }

  // Filter
  const { from, to } = periodRange(filterPeriod)
  const filtered = deals.filter(d => {
    if (d.closed_at < from || d.closed_at > to) return false
    if (filterStatus !== 'all' && d.status !== filterStatus) return false
    return true
  })

  // Stats (akkoord deals only for financials)
  const akkoordDeals     = filtered.filter(d => d.status === 'akkoord')
  const totalDealValue   = akkoordDeals.reduce((s, d) => s + Number(d.deal_value), 0)
  const totalCommission  = akkoordDeals.reduce((s, d) => s + Number(d.commission_amount), 0)
  const dealCount        = akkoordDeals.length
  const avgCommPct       = totalDealValue > 0 ? (totalCommission / totalDealValue * 100) : 0
  const openstaandeComm  = deals.reduce((s, d) => s + Math.max(0, Number(d.commission_amount) - Number(d.commission_received_amount)), 0)

  async function saveReceivedAmount(id: string) {
    const amt = parseFloat(editingCommAmt.replace(',', '.'))
    if (isNaN(amt) || amt < 0) return
    setSavingComm(true)
    const total = deals.find(d => d.id === id)?.commission_amount ?? 0
    mutate(prev => (prev ?? []).map(d => d.id === id
      ? { ...d, commission_received_amount: amt, commission_received: amt >= Number(d.commission_amount) }
      : d), false)
    await fetch(`/api/greenteam/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commission_received_amount: amt, commission_received: amt >= Number(total) }),
    })
    setSavingComm(false)
    setEditingCommId(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/greenteam/${deleteTarget.id}`, { method: 'DELETE' })
    mutate(prev => (prev ?? []).filter(d => d.id !== deleteTarget!.id), false)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const menuDeal = menuId ? deals.find(d => d.id === menuId) : null

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', fontSize: 'var(--font-size-xs)',
    background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--color-ink)', cursor: 'pointer', outline: 'none',
  }
  const thStyle: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'left',
    fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid var(--color-border-subtle)', whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '9px 12px', borderBottom: '1px solid var(--color-border-subtle)',
    fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', verticalAlign: 'middle',
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1300 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>GreenTeam</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
          Verduurzamingsdeal tracker — thuisbatterij, warmtepomp, zonnepanelen
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Omzet (akkoord)',          value: totalDealValue > 0 ? fmtEur(totalDealValue)  : '—', sub: `${dealCount} deal${dealCount !== 1 ? 's' : ''} akkoord` },
          { label: 'Commissie',                value: totalCommission > 0 ? fmtEur(totalCommission) : '—', sub: `Gem. ${avgCommPct.toFixed(1)}%` },
          { label: 'Openstaande commissie',    value: openstaandeComm > 0 ? fmtEur(openstaandeComm) : '—', sub: 'Nog niet ontvangen (all-time)', highlight: true },
          { label: 'Aantal deals',             value: String(dealCount), sub: 'Akkoord in periode' },
          { label: 'Gem. commissie %',         value: avgCommPct > 0 ? `${avgCommPct.toFixed(1)}%` : '—', sub: 'Commissie / omzet' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px', background: 'var(--color-surface)', border: `1px solid ${'highlight' in s && s.highlight ? 'rgba(63,185,80,0.3)' : 'var(--color-border-subtle)'}`, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'highlight' in s && s.highlight ? '#3fb950' : 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters + action */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={selectStyle}>
          <option value="month">Deze maand</option>
          <option value="last">Vorige maand</option>
          <option value="ytd">Dit jaar</option>
          <option value="all">Alles</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">Alle statussen</option>
          <option value="akkoord">Akkoord</option>
          <option value="geannuleerd">Geannuleerd</option>
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setEditDeal(null); setModal(true) }}
          style={{ padding: '7px 16px', background: '#3fb950', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
        >
          + Deal toevoegen
        </button>
      </div>

      {/* Deals table */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
            Geen deals in deze periode
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                {['Datum', 'Klant', 'Stad', 'Producten', 'Financiering', 'Omzet', 'Comm.%', 'Commissie', 'Status', 'Ontvangen', ''].map(h => (
                  <th key={h} style={{ ...thStyle, textAlign: ['Omzet', 'Commissie', 'Comm.%'].includes(h) ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const cancelled = d.status === 'geannuleerd'
                const rowOpacity = cancelled ? 0.5 : 1
                return (
                  <tr key={d.id}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-raised)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                  >
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', opacity: rowOpacity }}>{fmtDate(d.closed_at)}</td>
                    <td style={{ ...tdStyle, fontWeight: 500, opacity: rowOpacity, textDecoration: cancelled ? 'line-through' : 'none' }}>{d.client_name}</td>
                    <td style={{ ...tdStyle, color: 'var(--color-ink-muted)', opacity: rowOpacity }}>{d.location || '—'}</td>
                    <td style={{ ...tdStyle, opacity: rowOpacity }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', color: 'var(--color-ink-muted)' }}>{productsLabel(d)}</span>
                    </td>
                    <td style={{ ...tdStyle, opacity: rowOpacity }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>{financingLabel(d)}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: rowOpacity }}>{fmtEur(Number(d.deal_value))}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-xs)', opacity: rowOpacity }}>{Number(d.commission_pct).toFixed(1)}%</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: cancelled ? 'var(--color-ink-faint)' : 'var(--color-success)', opacity: rowOpacity }}>{fmtEur(Number(d.commission_amount))}</td>
                    <td style={{ ...tdStyle }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                        background: cancelled ? 'rgba(248,81,73,0.1)' : 'rgba(63,185,80,0.12)',
                        color:      cancelled ? '#f85149' : '#3fb950',
                      }}>
                        {cancelled ? 'Geannuleerd' : 'Akkoord'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      {!cancelled && (
                        editingCommId === d.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>€</span>
                            <input
                              autoFocus type="number" min="0" step="0.01"
                              value={editingCommAmt}
                              onChange={e => setEditingCommAmt(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveReceivedAmount(d.id); if (e.key === 'Escape') setEditingCommId(null) }}
                              style={{ width: 80, padding: '3px 6px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-ink)', fontSize: 'var(--font-size-xs)', outline: 'none' }}
                            />
                            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>/ {fmtEur(Number(d.commission_amount))}</span>
                            <button onClick={() => saveReceivedAmount(d.id)} disabled={savingComm} style={{ padding: '3px 8px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 'var(--font-size-2xs)', cursor: 'pointer' }}>✓</button>
                            <button onClick={() => setEditingCommId(null)} style={{ padding: '3px 6px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 'var(--font-size-2xs)', cursor: 'pointer', color: 'var(--color-ink-muted)' }}>✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingCommId(d.id); setEditingCommAmt(String(Number(d.commission_received_amount) || '')) }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', borderRadius: 12, border: '1px solid',
                              fontSize: 'var(--font-size-2xs)', fontWeight: 600, cursor: 'pointer',
                              background:   commStatus(d) === 'full' ? 'rgba(63,185,80,0.12)' : commStatus(d) === 'partial' ? 'rgba(240,136,62,0.10)' : 'transparent',
                              borderColor:  commStatus(d) === 'full' ? '#3fb950' : commStatus(d) === 'partial' ? '#f0883e' : 'var(--color-border)',
                              color:        commStatus(d) === 'full' ? '#3fb950' : commStatus(d) === 'partial' ? '#f0883e' : 'var(--color-ink-muted)',
                            }}
                          >
                            {commStatus(d) === 'full' ? '✓ Volledig' : commStatus(d) === 'partial' ? `Deels ${fmtEur(Number(d.commission_received_amount))}` : 'Openstaand'}
                          </button>
                        )
                      )}
                    </td>
                    <td style={{ ...tdStyle, width: 40, textAlign: 'center' }}>
                      <button onClick={ev => openMenu(ev, d.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16, padding: '2px 6px' }}>⋯</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Context menu */}
      {menuId && menuPos && menuDeal && (
        <RowMenu
          pos={menuPos}
          onEdit={() => { setEditDeal(menuDeal); setModal(true); setMenuId(null) }}
          onDelete={() => { setDeleteTarget(menuDeal); setMenuId(null) }}
        />
      )}

      {/* Modal */}
      {modal && (
        <GreenDealModal
          editDeal={editDeal}
          onSaved={saved => {
            mutate(prev => {
              const list = prev ?? []
              const idx  = list.findIndex(d => d.id === saved.id)
              if (idx >= 0) { const n = [...list]; n[idx] = saved; return n }
              return [saved, ...list]
            }, false)
            setModal(false); setEditDeal(null)
          }}
          onClose={() => { setModal(false); setEditDeal(null) }}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirmModal
          deal={deleteTarget}
          deleting={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
