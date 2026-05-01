'use client'

import { useState } from 'react'

interface Targets {
  deal_value_target:  number | null
  commission_target:  number | null
  ad_budget_target:   number | null
}

interface Props {
  month:           string   // YYYY-MM
  initial:         Targets | null
  periodLabel:     string
}

export function TargetsSection({ month, initial, periodLabel }: Props) {
  const [targets, setTargets] = useState<Targets>(initial ?? {
    deal_value_target: null, commission_target: null, ad_budget_target: null,
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')
  const [open,   setOpen]   = useState(false)

  function numVal(v: number | null) { return v == null ? '' : String(v) }
  function parseNum(s: string): number | null { const n = parseFloat(s); return isNaN(n) ? null : n }

  async function save() {
    setSaving(true); setSaved(false); setError('')
    const r = await fetch(`/api/targets/${month}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targets),
    })
    setSaving(false)
    if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? 'Opslaan mislukt'); return }
    const saved = await r.json()
    setTargets({ deal_value_target: saved.deal_value_target, commission_target: saved.commission_target, ad_budget_target: saved.ad_budget_target })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inp: React.CSSProperties = {
    padding: '6px 10px', background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--color-ink)', fontSize: 'var(--font-size-sm)', outline: 'none',
    width: 160, boxSizing: 'border-box' as const,
  }
  const lbl: React.CSSProperties = {
    fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block',
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 24 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>Targets {periodLabel}</span>
        </div>
        {!open && (targets.deal_value_target || targets.commission_target || targets.ad_budget_target) && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
            {[
              targets.deal_value_target  ? `Deal €${(targets.deal_value_target / 1000).toFixed(0)}k`  : null,
              targets.commission_target  ? `Comm. €${(targets.commission_target  / 1000).toFixed(0)}k` : null,
              targets.ad_budget_target   ? `Ad €${(targets.ad_budget_target      / 1000).toFixed(0)}k` : null,
            ].filter(Boolean).join(' · ')}
          </span>
        )}
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '16px 20px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Deal waarde target (€)</label>
            <input type="number" min="0" step="1000" value={numVal(targets.deal_value_target)}
              onChange={e => setTargets(t => ({ ...t, deal_value_target: parseNum(e.target.value) }))}
              placeholder="bijv. 500000" style={inp} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Commissie target (€)</label>
            <input type="number" min="0" step="500" value={numVal(targets.commission_target)}
              onChange={e => setTargets(t => ({ ...t, commission_target: parseNum(e.target.value) }))}
              placeholder="bijv. 25000" style={inp} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>Ad budget target (€)</label>
            <input type="number" min="0" step="500" value={numVal(targets.ad_budget_target)}
              onChange={e => setTargets(t => ({ ...t, ad_budget_target: parseNum(e.target.value) }))}
              placeholder="bijv. 10000" style={inp} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 2 }}>
            <button onClick={save} disabled={saving}
              style={{ padding: '7px 18px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'default' : 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 500, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
            {saved  && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>Opgeslagen</span>}
            {error  && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-critical)' }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
