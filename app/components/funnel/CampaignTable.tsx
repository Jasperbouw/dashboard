'use client'

import { useState } from 'react'
import type { CampaignRow } from '../../../lib/metrics'

const NICHE_LABELS: Record<string, string> = {
  bouw: 'Bouw', dakkapel: 'Dakkapel', daken: 'Daken', extras: 'Extras',
}
const NICHE_COLORS: Record<string, string> = {
  bouw:     'var(--color-info)',
  dakkapel: 'var(--color-quote)',
  daken:    'var(--color-success)',
  extras:   'var(--color-warning)',
}

type SortKey = keyof Pick<CampaignRow, 'leads' | 'routed' | 'inspecties' | 'offertes' | 'gewonnen'>

interface Props {
  campaigns: CampaignRow[]
}

export function CampaignTable({ campaigns }: Props) {
  const [sortKey,  setSortKey]  = useState<SortKey>('leads')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')
  const [nicheFilter, setNicheFilter] = useState<string | null>(null)

  const niches = [...new Set(campaigns.map(c => c.niche).filter(Boolean))] as string[]

  const filtered = campaigns
    .filter(c => !nicheFilter || c.niche === nicheFilter)
    .slice()
    .sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  const th: React.CSSProperties = {
    padding:    '8px 12px',
    fontSize:   'var(--font-size-xs)',
    fontWeight: 600,
    color:      'var(--color-ink-faint)',
    textAlign:  'left',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace:   'nowrap',
    cursor:       'pointer',
    userSelect:   'none',
  }

  const td: React.CSSProperties = {
    padding:   '9px 12px',
    fontSize:  'var(--font-size-sm)',
    color:     'var(--color-ink)',
    borderBottom: '1px solid var(--color-border-subtle)',
    whiteSpace: 'nowrap',
  }

  const tdNum: React.CSSProperties = {
    ...td,
    fontVariantNumeric: 'tabular-nums',
    textAlign:          'right',
  }

  return (
    <div>
      {/* Niche filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => setNicheFilter(null)}
          style={{
            fontSize: 'var(--font-size-xs)', padding: '3px 10px',
            borderRadius: 'var(--radius-full)', border: '1px solid',
            borderColor: !nicheFilter ? 'var(--color-info)' : 'var(--color-border)',
            background:  !nicheFilter ? 'var(--color-info-subtle)' : 'transparent',
            color:       !nicheFilter ? 'var(--color-info)' : 'var(--color-ink-muted)',
            cursor: 'pointer',
          }}
        >
          Alle
        </button>
        {niches.map(n => (
          <button
            key={n}
            onClick={() => setNicheFilter(nicheFilter === n ? null : n)}
            style={{
              fontSize: 'var(--font-size-xs)', padding: '3px 10px',
              borderRadius: 'var(--radius-full)', border: '1px solid',
              borderColor: nicheFilter === n ? 'var(--color-info)' : 'var(--color-border)',
              background:  nicheFilter === n ? 'var(--color-info-subtle)' : 'transparent',
              color:       nicheFilter === n ? 'var(--color-info)' : 'var(--color-ink-muted)',
              cursor: 'pointer',
            }}
          >
            {NICHE_LABELS[n] ?? n}
          </button>
        ))}
        <span style={{
          marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)',
          alignSelf: 'center',
        }}>
          {filtered.length} campagnes
        </span>
      </div>

      {/* Table */}
      <div style={{
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow:     'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, cursor: 'default' }}>Campagne</th>
              <th style={{ ...th, cursor: 'default' }}>Niche</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('leads')}>
                Leads{arrow('leads')}
              </th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('routed')}>
                Gerouteerd{arrow('routed')}
              </th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('inspecties')}>
                Inspecties{arrow('inspecties')}
              </th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('offertes')}>
                Offertes{arrow('offertes')}
              </th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('gewonnen')}>
                Gewonnen{arrow('gewonnen')}
              </th>
              <th style={{ ...th, textAlign: 'right', cursor: 'default' }}>CPL</th>
              <th style={{ ...th, textAlign: 'right', cursor: 'default' }}>CPQL</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: 'center', color: 'var(--color-ink-faint)', padding: '32px' }}>
                  Geen campagnes in geselecteerde periode
                </td>
              </tr>
            )}
            {filtered.map(row => {
              const routedPct = row.leads > 0 ? Math.round((row.routed / row.leads) * 100) : 0
              return (
                <tr key={row.campaign_tag} style={{ transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={td}>
                    <span style={{
                      fontFamily:  'monospace',
                      fontSize:    'var(--font-size-xs)',
                      color:       'var(--color-ink)',
                      background:  'var(--color-surface-raised)',
                      borderRadius: 'var(--radius-sm)',
                      padding:     '2px 6px',
                    }}>
                      {row.campaign_tag}
                    </span>
                  </td>
                  <td style={td}>
                    {row.niche ? (
                      <span style={{
                        fontSize:     'var(--font-size-xs)',
                        color:        NICHE_COLORS[row.niche] ?? 'var(--color-ink-muted)',
                        background:   'var(--color-surface-raised)',
                        borderRadius: 'var(--radius-full)',
                        padding:      '2px 8px',
                        border:       '1px solid var(--color-border-subtle)',
                      }}>
                        {NICHE_LABELS[row.niche] ?? row.niche}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-ink-faint)' }}>—</span>
                    )}
                  </td>
                  <td style={tdNum}>{row.leads}</td>
                  <td style={tdNum}>
                    <span>{row.routed}</span>
                    <span style={{ color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-xs)', marginLeft: 4 }}>
                      {routedPct}%
                    </span>
                  </td>
                  <td style={tdNum}>{row.inspecties || <span style={{ color: 'var(--color-ink-faint)' }}>—</span>}</td>
                  <td style={tdNum}>{row.offertes  || <span style={{ color: 'var(--color-ink-faint)' }}>—</span>}</td>
                  <td style={tdNum}>{row.gewonnen  || <span style={{ color: 'var(--color-ink-faint)' }}>—</span>}</td>
                  <td style={{ ...tdNum, color: 'var(--color-ink-faint)' }}>—</td>
                  <td style={{ ...tdNum, color: 'var(--color-ink-faint)' }}>—</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
