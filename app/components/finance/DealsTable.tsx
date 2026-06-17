'use client'
import { useState } from 'react'

type Deal = {
  id: string
  client_name: string
  deal_value: number
  commission_amount: number
  commission_received: boolean
  closed_at: string
  niche: string | null
  contractor: { name: string } | null
}

interface Props {
  deals: Deal[]
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function DealsTable({ deals: initial }: Props) {
  const [deals, setDeals] = useState(initial)
  const [pending, setPending] = useState<string | null>(null)

  const outstanding = deals
    .filter(d => !d.commission_received)
    .reduce((s, d) => s + Number(d.commission_amount), 0)

  const received = deals
    .filter(d => d.commission_received)
    .reduce((s, d) => s + Number(d.commission_amount), 0)

  async function toggle(id: string, current: boolean) {
    setPending(id)
    setDeals(prev => prev.map(d => d.id === id ? { ...d, commission_received: !current } : d))
    const res = await fetch(`/api/deals/closed/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commission_received: !current }),
    })
    if (!res.ok) {
      setDeals(prev => prev.map(d => d.id === id ? { ...d, commission_received: current } : d))
    }
    setPending(null)
  }

  if (deals.length === 0) {
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-faint)', padding: '16px 0' }}>
        Geen deals deze maand.
      </div>
    )
  }

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginRight: 6 }}>Openstaand</span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: outstanding > 0 ? '#f0883e' : 'var(--color-ink-faint)', fontVariantNumeric: 'tabular-nums' }}>
            {outstanding > 0 ? fmtEur(outstanding) : '—'}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', marginRight: 6 }}>Ontvangen</span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: '#3fb950', fontVariantNumeric: 'tabular-nums' }}>
            {received > 0 ? fmtEur(received) : '—'}
          </span>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Datum', 'Klant', 'Aannemer', 'Commissie', 'Ontvangen'].map((h, i) => (
              <th key={h} style={{
                textAlign: i >= 3 ? 'right' : 'left',
                fontSize: 'var(--font-size-2xs)', fontWeight: 600,
                color: 'var(--color-ink-faint)', textTransform: 'uppercase',
                letterSpacing: '0.06em', paddingBottom: 10,
                borderBottom: '1px solid var(--color-border-subtle)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map((deal, i) => (
            <tr key={deal.id} style={{ borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : undefined }}>
              <td style={{ padding: '10px 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', whiteSpace: 'nowrap' }}>
                {fmtDate(deal.closed_at)}
              </td>
              <td style={{ padding: '10px 12px 10px 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)', fontWeight: 500 }}>
                {deal.client_name}
              </td>
              <td style={{ padding: '10px 12px 10px 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
                {deal.contractor?.name ?? '—'}
              </td>
              <td style={{ padding: '10px 0', textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {fmtEur(Number(deal.commission_amount))}
              </td>
              <td style={{ padding: '10px 0', textAlign: 'right' }}>
                <button
                  onClick={() => toggle(deal.id, deal.commission_received)}
                  disabled={pending === deal.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 12,
                    border: '1px solid',
                    fontSize: 'var(--font-size-2xs)', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s',
                    opacity: pending === deal.id ? 0.5 : 1,
                    background: deal.commission_received ? 'rgba(63,185,80,0.12)' : 'rgba(240,136,62,0.10)',
                    borderColor: deal.commission_received ? '#3fb950' : '#f0883e',
                    color: deal.commission_received ? '#3fb950' : '#f0883e',
                  }}
                >
                  {deal.commission_received ? '✓ Ontvangen' : 'Openstaand'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
