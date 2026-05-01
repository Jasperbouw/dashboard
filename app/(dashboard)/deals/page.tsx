'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 30_000 } as const

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contractor { id: string; name: string; niche: string }

interface Deal {
  id:                string
  client_name:       string
  contractor_id:     string | null
  niche:             string | null
  deal_value:        number
  commission_amount: number
  closed_at:         string
  description:       string | null
  contractor:        { name: string; niche: string } | null
}

interface AdBudget {
  id:            string
  contractor_id: string | null
  amount:        number
  received_at:   string
  description:   string | null
  contractor:    { name: string; niche: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtPct(a: number, b: number) {
  if (!b) return '—'
  return `${(a / b * 100).toFixed(1)}%`
}

function today() { return new Date().toISOString().slice(0, 10) }

function periodRange(period: string): { from: string; to: string } {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth()

  if (period === 'month') {
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const to   = new Date(y, m + 1, 0).toISOString().slice(0, 10)
    return { from, to }
  }
  if (period === 'last') {
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const to   = new Date(y, m, 0).toISOString().slice(0, 10)
    // handle January
    const d = new Date(y, m - 1, 1)
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: new Date(y, m, 0).toISOString().slice(0, 10) }
  }
  if (period === 'ytd') return { from: `${y}-01-01`, to: now.toISOString().slice(0, 10) }
  return { from: '2000-01-01', to: '2099-12-31' }  // all
}

// ── Deal modal ────────────────────────────────────────────────────────────────

const DEAL_EMPTY = {
  client_name: '', contractor_id: '', niche: '', deal_value: '', commission_amount: '', closed_at: today(), description: '',
}

function DealModal({
  contractors,
  editDeal,
  onSaved,
  onClose,
}: {
  contractors:  Contractor[]
  editDeal:     Deal | null
  onSaved:      (d: Deal) => void
  onClose:      () => void
}) {
  const [form, setForm] = useState(() => editDeal ? {
    client_name:       editDeal.client_name,
    contractor_id:     editDeal.contractor_id ?? '',
    niche:             editDeal.niche ?? '',
    deal_value:        String(editDeal.deal_value),
    commission_amount: String(editDeal.commission_amount),
    closed_at:         editDeal.closed_at,
    description:       editDeal.description ?? '',
  } : { ...DEAL_EMPTY })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  // Auto-fill niche from contractor
  useEffect(() => {
    if (!form.contractor_id || editDeal) return
    const c = contractors.find(x => x.id === form.contractor_id)
    if (c?.niche) set('niche', c.niche)
  }, [form.contractor_id])

  const commPct = form.deal_value && form.commission_amount
    ? ((Number(form.commission_amount) / Number(form.deal_value)) * 100).toFixed(2)
    : null

  async function submit() {
    if (!form.client_name || !form.deal_value || !form.commission_amount || !form.closed_at) {
      setError('Vul alle verplichte velden in'); return
    }
    setSaving(true); setError('')
    const method = editDeal ? 'PATCH' : 'POST'
    const url    = editDeal ? `/api/deals/closed/${editDeal.id}` : '/api/deals/closed'
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name:       form.client_name,
        contractor_id:     form.contractor_id || null,
        niche:             form.niche || null,
        deal_value:        Number(form.deal_value),
        commission_amount: Number(form.commission_amount),
        closed_at:         form.closed_at,
        description:       form.description || null,
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 500, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>{editDeal ? 'Deal bewerken' : 'Closed deal toevoegen'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '70vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Klant naam *</label>
            <input type="text" value={form.client_name} onChange={e => set('client_name', e.target.value)} style={inp} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Contractor</label>
              <select value={form.contractor_id} onChange={e => set('contractor_id', e.target.value)} style={inp}>
                <option value="">— Geen contractor</option>
                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Niche</label>
              <input type="text" value={form.niche} onChange={e => set('niche', e.target.value)} placeholder="bouw / daken / …" style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Deal waarde (€) *</label>
              <input type="number" min="0" step="0.01" value={form.deal_value} onChange={e => set('deal_value', e.target.value)} placeholder="0" style={inp} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Commissie (€) *</label>
              <input type="number" min="0" step="0.01" value={form.commission_amount} onChange={e => set('commission_amount', e.target.value)} placeholder="0" style={inp} />
            </div>
          </div>
          {commPct && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: -8 }}>
              Effectieve commissie: <strong style={{ color: 'var(--color-ink)' }}>{commPct}%</strong>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Closed datum *</label>
            <input type="date" value={form.closed_at} onChange={e => set('closed_at', e.target.value)} style={inp} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Beschrijving (optioneel)</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>
          {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>Annuleren</button>
          <button onClick={submit} disabled={saving} style={{ padding: '7px 16px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : editDeal ? 'Opslaan' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ad budget modal ───────────────────────────────────────────────────────────

const AB_EMPTY = { contractor_id: '', amount: '', received_at: today(), description: '' }

function AdBudgetModal({
  contractors,
  editRow,
  onSaved,
  onClose,
}: {
  contractors: Contractor[]
  editRow:     AdBudget | null
  onSaved:     (r: AdBudget) => void
  onClose:     () => void
}) {
  const [form, setForm] = useState(() => editRow ? {
    contractor_id: editRow.contractor_id ?? '',
    amount:        String(editRow.amount),
    received_at:   editRow.received_at,
    description:   editRow.description ?? '',
  } : { ...AB_EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    if (!form.amount || !form.received_at) { setError('Vul bedrag en datum in'); return }
    setSaving(true); setError('')
    const method = editRow ? 'PATCH' : 'POST'
    const url    = editRow ? `/api/ad-budget-revenue/${editRow.id}` : '/api/ad-budget-revenue'
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractor_id: form.contractor_id || null, amount: Number(form.amount), received_at: form.received_at, description: form.description || null }),
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>{editRow ? 'Ad budget bewerken' : 'Ad budget ontvangen'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Contractor</label>
            <select value={form.contractor_id} onChange={e => set('contractor_id', e.target.value)} style={inp}>
              <option value="">— Geen contractor</option>
              {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Bedrag (€) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" style={inp} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Datum ontvangen *</label>
              <input type="date" value={form.received_at} onChange={e => set('received_at', e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Beschrijving</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="optioneel" style={inp} />
          </div>
          {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>Annuleren</button>
          <button onClick={submit} disabled={saving} style={{ padding: '7px 16px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'default' : 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 500, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : 'Opslaan'}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const { data: rawDeals,   mutate: mutateDeals   } = useSWR<Deal[]>('/api/deals/closed',    fetcher, SWR_OPTS)
  const { data: rawAdBudget, mutate: mutateAdBudget } = useSWR<AdBudget[]>('/api/ad-budget-revenue', fetcher, SWR_OPTS)
  const { data: rawContractors }                      = useSWR<Contractor[]>('/api/contractors', fetcher, SWR_OPTS)

  const deals       = Array.isArray(rawDeals)    ? rawDeals    : []
  const adBudgets   = Array.isArray(rawAdBudget) ? rawAdBudget : []
  const contractors = Array.isArray(rawContractors) ? rawContractors : []

  // Filters
  const [filterPeriod,     setFilterPeriod]     = useState('month')
  const [filterContractor, setFilterContractor] = useState('')

  // Modals
  const [dealModal,     setDealModal]     = useState(false)
  const [editDeal,      setEditDeal]      = useState<Deal | null>(null)
  const [adBudgetModal, setAdBudgetModal] = useState(false)
  const [editAdBudget,  setEditAdBudget]  = useState<AdBudget | null>(null)

  // Context menus
  const [menuId,  setMenuId]  = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const menuType = useRef<'deal' | 'ab'>('deal')

  function openMenu(e: React.MouseEvent, id: string, type: 'deal' | 'ab') {
    e.stopPropagation()
    if (menuId === id) { setMenuId(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    menuType.current = type
    setMenuId(id)
  }

  useEffect(() => {
    function close() { setMenuId(null); setMenuPos(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // Filter
  const { from, to } = periodRange(filterPeriod)
  const filteredDeals = deals.filter(d => {
    if (d.closed_at < from || d.closed_at > to) return false
    if (filterContractor && d.contractor_id !== filterContractor) return false
    return true
  })
  const filteredAB = adBudgets.filter(a => {
    if (a.received_at < from || a.received_at > to) return false
    if (filterContractor && a.contractor_id !== filterContractor) return false
    return true
  })

  // Stats (from filtered deals)
  const totalDealValue   = filteredDeals.reduce((s, d) => s + Number(d.deal_value), 0)
  const totalCommission  = filteredDeals.reduce((s, d) => s + Number(d.commission_amount), 0)
  const dealCount        = filteredDeals.length
  const avgCommPct       = totalDealValue > 0 ? (totalCommission / totalDealValue * 100) : 0

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

  async function deleteDeal(id: string) {
    if (!confirm('Deal verwijderen?')) return
    await fetch(`/api/deals/closed/${id}`, { method: 'DELETE' })
    mutateDeals(prev => (prev ?? []).filter(d => d.id !== id), false)
  }

  async function deleteAB(id: string) {
    if (!confirm('Ad budget entry verwijderen?')) return
    await fetch(`/api/ad-budget-revenue/${id}`, { method: 'DELETE' })
    mutateAdBudget(prev => (prev ?? []).filter(a => a.id !== id), false)
  }

  const menuDeal = menuId && menuType.current === 'deal' ? deals.find(d => d.id === menuId) : null
  const menuAB   = menuId && menuType.current === 'ab'   ? adBudgets.find(a => a.id === menuId) : null

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>Deals</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4, marginBottom: 0 }}>
          Closed deals en gegenereerde commissies
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Closed deals waarde', value: fmtEur(totalDealValue),  sub: `${dealCount} deal${dealCount !== 1 ? 's' : ''} geland` },
          { label: 'Onze commissie',       value: fmtEur(totalCommission), sub: `Gem. ${avgCommPct.toFixed(1)}% commissie` },
          { label: 'Aantal deals',         value: String(dealCount),       sub: 'Gesloten in periode' },
          { label: 'Gem. commissie %',     value: avgCommPct > 0 ? `${avgCommPct.toFixed(1)}%` : '—', sub: 'Commissie / deal waarde' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters + actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={selectStyle}>
          <option value="month">Deze maand</option>
          <option value="last">Vorige maand</option>
          <option value="ytd">Dit jaar</option>
          <option value="all">Alles</option>
        </select>
        <select value={filterContractor} onChange={e => setFilterContractor(e.target.value)} style={selectStyle}>
          <option value="">Alle contractors</option>
          {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setEditAdBudget(null); setAdBudgetModal(true) }}
          style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', fontWeight: 500 }}
        >
          + Ad Budget ontvangen
        </button>
        <button
          onClick={() => { setEditDeal(null); setDealModal(true) }}
          style={{ padding: '7px 16px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
        >
          + Closed Deal
        </button>
      </div>

      {/* Deals table */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'auto', marginBottom: 32 }}>
        {filteredDeals.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
            Geen deals in deze periode
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
            <thead>
              <tr>
                {['Datum', 'Klant', 'Contractor', 'Niche', 'Deal waarde', 'Commissie', '%', ''].map(h => (
                  <th key={h} style={{ ...thStyle, textAlign: ['Deal waarde', 'Commissie', '%'].includes(h) ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map(d => (
                <tr key={d.id}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-raised)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                >
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(d.closed_at)}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{d.client_name}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-ink-muted)' }}>{d.contractor?.name ?? '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-ink-muted)', fontSize: 'var(--font-size-xs)' }}>{d.niche ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(Number(d.deal_value))}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--color-success)' }}>{fmtEur(Number(d.commission_amount))}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-xs)' }}>{fmtPct(Number(d.commission_amount), Number(d.deal_value))}</td>
                  <td style={{ ...tdStyle, width: 40, textAlign: 'center' }}>
                    <button onClick={ev => openMenu(ev, d.id, 'deal')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16, padding: '2px 6px' }}>⋯</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ad budget section */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Ad Budget Revenue
        </div>
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'auto' }}>
        {filteredAB.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)' }}>
            Geen ad budget ontvangen in deze periode
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                {['Datum', 'Contractor', 'Bedrag', 'Beschrijving', ''].map(h => (
                  <th key={h} style={{ ...thStyle, textAlign: h === 'Bedrag' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAB.map(a => (
                <tr key={a.id}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-raised)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                >
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(a.received_at)}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-ink-muted)' }}>{a.contractor?.name ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtEur(Number(a.amount))}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-ink-muted)', maxWidth: 280 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description ?? '—'}</span>
                  </td>
                  <td style={{ ...tdStyle, width: 40, textAlign: 'center' }}>
                    <button onClick={ev => openMenu(ev, a.id, 'ab')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', fontSize: 16, padding: '2px 6px' }}>⋯</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Context menus */}
      {menuId && menuPos && menuDeal && (
        <RowMenu pos={menuPos}
          onEdit={() => { setEditDeal(menuDeal); setDealModal(true); setMenuId(null) }}
          onDelete={() => { deleteDeal(menuDeal.id); setMenuId(null) }}
        />
      )}
      {menuId && menuPos && menuAB && (
        <RowMenu pos={menuPos}
          onEdit={() => { setEditAdBudget(menuAB); setAdBudgetModal(true); setMenuId(null) }}
          onDelete={() => { deleteAB(menuAB.id); setMenuId(null) }}
        />
      )}

      {/* Modals */}
      {dealModal && (
        <DealModal
          contractors={contractors}
          editDeal={editDeal}
          onSaved={saved => {
            mutateDeals(prev => {
              const list = prev ?? []
              const idx = list.findIndex(d => d.id === saved.id)
              if (idx >= 0) { const n = [...list]; n[idx] = saved; return n }
              return [saved, ...list]
            }, false)
            setDealModal(false); setEditDeal(null)
          }}
          onClose={() => { setDealModal(false); setEditDeal(null) }}
        />
      )}
      {adBudgetModal && (
        <AdBudgetModal
          contractors={contractors}
          editRow={editAdBudget}
          onSaved={saved => {
            mutateAdBudget(prev => {
              const list = prev ?? []
              const idx = list.findIndex(a => a.id === saved.id)
              if (idx >= 0) { const n = [...list]; n[idx] = saved; return n }
              return [saved, ...list]
            }, false)
            setAdBudgetModal(false); setEditAdBudget(null)
          }}
          onClose={() => { setAdBudgetModal(false); setEditAdBudget(null) }}
        />
      )}
    </div>
  )
}
