'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ContractorSummary } from '../../../lib/metrics'
import { ContractorPanel } from './ContractorPanel'

// ── Display helpers ───────────────────────────────────────────────────────────

const NICHE_LABEL: Record<string, string> = {
  bouw: 'Bouw', dakkapel: 'Dakkapel', daken: 'Daken', extras: 'Extras',
}

const NICHE_COLOR: Record<string, { color: string; bg: string }> = {
  bouw:     { color: 'var(--color-info)',    bg: 'var(--color-info-subtle)'    },
  daken:    { color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
  dakkapel: { color: 'var(--color-quote)',   bg: 'var(--color-quote-subtle)'   },
  extras:   { color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)' },
}

const NICHE_SORT_ORDER: Record<string, number> = {
  bouw: 0, daken: 1, dakkapel: 2, extras: 3,
}

// Niches where avg deal size is meaningful (high-value project-based models).
// Keep in sync with YTD_NICHES in app/(dashboard)/finance/page.tsx.
const DEAL_VALUE_NICHES = new Set(['bouw', 'zwembaden', 'pergolas', 'nieuwbouw'])

const MODEL_LABEL: Record<string, string> = {
  percentage: '%', flat_fee: 'Flat', retainer: 'Ret.',
}
const SERVICE_LABEL: Record<string, string> = {
  full_sales: 'Full', leads_only: 'Leads', hands_off: 'Passief',
}

function fmtEur(v: number | null) {
  if (v == null || v === 0) return '—'
  return `€${v.toLocaleString('nl-NL')}`
}
function fmtPct(v: number | null) {
  if (v == null) return '—'
  return `${v}%`
}
function fmtAge(iso: string | null) {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Gisteren'
  return `${days}d geleden`
}

function Dash() {
  return <span style={{ color: 'var(--color-ink-faint)' }}>—</span>
}

function Pill({ label, color, bg, title }: { label: string; color: string; bg: string; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display:      'inline-block',
        fontSize:     'var(--font-size-2xs)',
        fontWeight:   600,
        color,
        background:   bg,
        borderRadius: 'var(--radius-full)',
        padding:      '1px 7px',
        whiteSpace:   'nowrap',
        cursor:       title ? 'help' : undefined,
      }}
    >
      {label}
    </span>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey =
  | 'niche' | 'leadsReceived' | 'qualificationRate'
  | 'dealsTotal' | 'closeRate' | 'avgDealSize' | 'commissionBooked'

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  contractors: ContractorSummary[]
}

export function ContractorsTable({ contractors }: Props) {
  const router = useRouter()
  const [sortKey, setSortKey]       = useState<SortKey>('niche')
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')
  const [nicheFilter, setNiche]     = useState<string | null>(null)
  const [serviceFilter, setService] = useState<string | null>(null)
  const [modelFilter, setModel]     = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedContractor = useMemo(
    () => contractors.find(c => c.id === selectedId) ?? null,
    [contractors, selectedId],
  )
  const closePanel = useCallback(() => setSelectedId(null), [])

  const niches   = [...new Set(contractors.map(c => c.niche).filter(Boolean))] as string[]
  const services = [...new Set(contractors.map(c => c.service_model).filter(Boolean))] as string[]
  const models   = [...new Set(contractors.map(c => c.commission_model).filter(Boolean))] as string[]

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir(key === 'niche' ? 'asc' : 'desc') }
  }

  const sorted = useMemo(() => {
    return contractors
      .filter(c =>
        (!nicheFilter   || c.niche           === nicheFilter) &&
        (!serviceFilter || c.service_model   === serviceFilter) &&
        (!modelFilter   || c.commission_model === modelFilter)
      )
      .slice()
      .sort((a, b) => {
        let av: number | string, bv: number | string
        switch (sortKey) {
          case 'niche':             av = NICHE_SORT_ORDER[a.niche] ?? 99; bv = NICHE_SORT_ORDER[b.niche] ?? 99; break
          case 'leadsReceived':     av = a.leadsReceived;    bv = b.leadsReceived;    break
          case 'qualificationRate': av = a.qualificationRate ?? -1; bv = b.qualificationRate ?? -1; break
          case 'dealsTotal':        av = a.dealsTotal;       bv = b.dealsTotal;       break
          case 'closeRate':         av = a.closeRate ?? -1;  bv = b.closeRate ?? -1;  break
          case 'avgDealSize':       av = a.avgDealSize ?? -1; bv = b.avgDealSize ?? -1; break
          case 'commissionBooked':  av = a.commissionBooked; bv = b.commissionBooked; break
          default: av = 0; bv = 0
        }
        const primary = typeof av === 'string'
          ? (sortDir === 'asc' ? bv > av ? -1 : 1 : av > bv ? -1 : 1)
          : (sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number))
        if (primary !== 0) return primary

        // Secondary sorts
        if (sortKey === 'niche') {
          return b.leadsReceived - a.leadsReceived
        }
        if (sortKey === 'commissionBooked') {
          const byPending = b.commissionPending - a.commissionPending
          if (byPending !== 0) return byPending
          return b.leadsReceived - a.leadsReceived
        }
        return 0
      })
  }, [contractors, sortKey, sortDir, nicheFilter, serviceFilter, modelFilter])

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const th: React.CSSProperties = {
    padding:       '8px 10px',
    fontSize:      'var(--font-size-xs)',
    fontWeight:    600,
    color:         'var(--color-ink-faint)',
    textAlign:     'left',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom:  '1px solid var(--color-border)',
    whiteSpace:    'nowrap',
    cursor:        'pointer',
    userSelect:    'none',
  }
  const td: React.CSSProperties = {
    padding:      '9px 10px',
    fontSize:     'var(--font-size-sm)',
    color:        'var(--color-ink)',
    borderBottom: '1px solid var(--color-border-subtle)',
    whiteSpace:   'nowrap',
  }
  const tdNum: React.CSSProperties = {
    ...td,
    fontVariantNumeric: 'tabular-nums',
    textAlign:          'right',
  }

  function filterPill(
    label: string,
    active: boolean,
    onClick: () => void,
  ) {
    return (
      <button
        key={label}
        onClick={onClick}
        style={{
          fontSize: 'var(--font-size-xs)', padding: '3px 10px',
          borderRadius: 'var(--radius-full)', border: '1px solid',
          borderColor: active ? 'var(--color-info)' : 'var(--color-border)',
          background:  active ? 'var(--color-info-subtle)' : 'transparent',
          color:       active ? 'var(--color-info)' : 'var(--color-ink-muted)',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {filterPill('Alle', !nicheFilter && !serviceFilter && !modelFilter, () => { setNiche(null); setService(null); setModel(null) })}

        <span style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 2px' }} />

        {niches.map(n => filterPill(NICHE_LABEL[n] ?? n, nicheFilter === n, () => setNiche(nicheFilter === n ? null : n)))}

        <span style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 2px' }} />

        {services.map(s => filterPill(SERVICE_LABEL[s] ?? s, serviceFilter === s, () => setService(serviceFilter === s ? null : s)))}

        <span style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 2px' }} />

        {models.map(m => filterPill(MODEL_LABEL[m] ?? m, modelFilter === m, () => setModel(modelFilter === m ? null : m)))}

        <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)', alignSelf: 'center' }}>
          {sorted.length} contractors
        </span>
      </div>

      {/* Table */}
      <div style={{
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow:     'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...th, cursor: 'default' }}>Aannemer</th>
              <th style={{ ...th, cursor: 'default' }}>Model</th>
              <th style={{ ...th, minWidth: 120, cursor: 'default' }}>Pakketten</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('leadsReceived')}>Leads{arrow('leadsReceived')}</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('qualificationRate')}>Qual%{arrow('qualificationRate')}</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('dealsTotal')}>Deals{arrow('dealsTotal')}</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('closeRate')}>Close%{arrow('closeRate')}</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('avgDealSize')}>Gem. deal{arrow('avgDealSize')}</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('commissionBooked')}>Comm.{arrow('commissionBooked')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: 'center', color: 'var(--color-ink-faint)', padding: '32px' }}>
                  Geen contractors gevonden
                </td>
              </tr>
            )}
            {sorted.map(c => {
              const isSelected = c.id === selectedId
              return (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(isSelected ? null : c.id)}
                  style={{
                    transition: 'background 0.1s',
                    background: isSelected ? 'var(--color-surface-raised)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-raised)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Name + niche */}
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{c.name}</span>
                      <span style={{
                        fontSize:     'var(--font-size-2xs)',
                        fontWeight:   500,
                        color:        NICHE_COLOR[c.niche]?.color ?? 'var(--color-ink-muted)',
                        background:   NICHE_COLOR[c.niche]?.bg    ?? 'var(--color-surface-raised)',
                        borderRadius: 'var(--radius-full)',
                        padding:      '1px 6px',
                        border:       `1px solid ${NICHE_COLOR[c.niche]?.color ?? 'var(--color-border-subtle)'}`,
                        opacity:      0.85,
                      }}>
                        {NICHE_LABEL[c.niche] ?? c.niche}
                      </span>
                    </div>
                  </td>

                  {/* Model badges */}
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {c.commission_model && (
                        <span style={{
                          fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-muted)',
                          background: 'var(--color-surface-raised)',
                          borderRadius: 'var(--radius-sm)', padding: '1px 5px',
                          border: '1px solid var(--color-border-subtle)',
                        }}>
                          {MODEL_LABEL[c.commission_model] ?? c.commission_model}
                        </span>
                      )}
                      {c.service_model && (
                        <span style={{
                          fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-muted)',
                          background: 'var(--color-surface-raised)',
                          borderRadius: 'var(--radius-sm)', padding: '1px 5px',
                          border: '1px solid var(--color-border-subtle)',
                        }}>
                          {SERVICE_LABEL[c.service_model] ?? c.service_model}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Active packs */}
                  <td style={{ ...td, minWidth: 120 }}>
                    {c.activePacks.count === 0 ? (
                      <Dash />
                    ) : c.activePacks.count > 1 ? (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
                        {c.activePacks.count} actieve pakketten
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
                          {c.activePacks.used} / {c.activePacks.promised} · {c.activePacks.pct}%
                        </span>
                        <div style={{ height: 3, borderRadius: 2, background: 'var(--color-surface-raised)', overflow: 'hidden', width: 64 }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, c.activePacks.pct ?? 0)}%`,
                            background: (c.activePacks.pct ?? 0) >= 80 ? 'var(--color-warning)' : 'var(--color-accent)',
                            borderRadius: 2,
                          }} />
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Leads */}
                  <td style={tdNum}>{c.leadsReceived || <Dash />}</td>

                  {/* Qual% */}
                  <td style={tdNum}>{fmtPct(c.qualificationRate)}</td>

                  {/* Deals */}
                  <td style={tdNum}>{c.dealsTotal || <Dash />}</td>

                  {/* Close% */}
                  <td style={tdNum}>{fmtPct(c.closeRate)}</td>

                  {/* Avg deal size — only shown for high-value niches */}
                  <td style={tdNum}>{DEAL_VALUE_NICHES.has(c.niche) ? fmtEur(c.avgDealSize) : <Dash />}</td>

                  {/* Commission MTD */}
                  <td style={{ ...tdNum, color: c.commissionBooked > 0 ? 'var(--color-success)' : 'var(--color-ink-faint)' }}>
                    {fmtEur(c.commissionBooked)}
                  </td>

                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ContractorPanel
        contractor={selectedContractor}
        onClose={closePanel}
        onPacksChanged={() => router.refresh()}
      />
    </div>
  )
}
