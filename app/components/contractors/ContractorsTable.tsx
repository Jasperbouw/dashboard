'use client'

import { useState, useMemo, useCallback } from 'react'
import type { ContractorSummary, ContractorHealth } from '../../../lib/metrics'
import { ContractorPanel } from './ContractorPanel'

// Keep in sync with ContractorHealth union in lib/metrics.ts

// ── Display helpers ───────────────────────────────────────────────────────────

const NICHE_LABEL: Record<string, string> = {
  bouw: 'Bouw', dakkapel: 'Dakkapel', daken: 'Daken', extras: 'Extras',
}

const HEALTH_META: Record<ContractorHealth, { label: string; color: string; bg: string; order: number }> = {
  critical:           { label: 'Kritiek',          color: 'var(--color-critical)',  bg: 'var(--color-critical-subtle)',  order: 0 },
  warning:            { label: 'Let op',            color: 'var(--color-warning)',   bg: 'var(--color-warning-subtle)',   order: 1 },
  'on-track':         { label: 'Performing',        color: 'var(--color-success)',   bg: 'var(--color-success-subtle)',   order: 2 },
  active:             { label: 'Lopend',            color: 'var(--color-info)',      bg: 'var(--color-info-subtle)',      order: 3 },
  'insufficient-data':{ label: 'Onvoldoende data',  color: 'var(--color-ink-muted)', bg: 'var(--color-surface-raised)',   order: 4 },
  idle:               { label: 'Inactief',          color: 'var(--color-ink-faint)', bg: 'var(--color-surface-raised)',   order: 5 },
}

const HEALTH_TOOLTIP: Record<ContractorHealth, string> = {
  critical:           'Handmatig gemarkeerd als at-risk relatie',
  warning:            '60+ dagen actief, 5+ offertes verzonden, close rate <15%',
  'on-track':         '60+ dagen actief, ≥1 deal gewonnen, close rate >15%',
  active:             'Actieve relatie — performance metrics nog niet beoordelend',
  'insufficient-data':'Eerste lead minder dan 60 dagen geleden — te vroeg om te oordelen',
  idle:               'Geen leads ontvangen in laatste 30 dagen',
}

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
  | 'health' | 'leadsReceived' | 'qualificationRate'
  | 'closeRate' | 'avgDealSize' | 'commissionBooked'
  | 'lastActivity'

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  contractors: ContractorSummary[]
}

export function ContractorsTable({ contractors }: Props) {
  const [sortKey, setSortKey]       = useState<SortKey>('commissionBooked')
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc')
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
    else { setSortKey(key); setSortDir(key === 'health' || key === 'lastActivity' ? 'asc' : 'desc') }
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
          case 'health':            av = HEALTH_META[a.health].order; bv = HEALTH_META[b.health].order; break
          case 'leadsReceived':     av = a.leadsReceived;    bv = b.leadsReceived;    break
          case 'qualificationRate': av = a.qualificationRate ?? -1; bv = b.qualificationRate ?? -1; break
          case 'closeRate':         av = a.closeRate ?? -1;  bv = b.closeRate ?? -1;  break
          case 'avgDealSize':       av = a.avgDealSize ?? -1; bv = b.avgDealSize ?? -1; break
          case 'commissionBooked':  av = a.commissionBooked; bv = b.commissionBooked; break

          case 'lastActivity':      av = a.lastActivity ?? ''; bv = b.lastActivity ?? ''; break
          default: av = 0; bv = 0
        }
        const primary = typeof av === 'string'
          ? (sortDir === 'asc' ? bv > av ? -1 : 1 : av > bv ? -1 : 1)
          : (sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number))
        if (primary !== 0) return primary

        // Stable tiebreaker for commissionBooked (default sort):
        // secondary = commissionPending desc, tertiary = leadsReceived desc
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
              <th style={th} onClick={() => toggleSort('health')}>Status{arrow('health')}</th>
              <th style={{ ...th, cursor: 'default' }}>Model</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('leadsReceived')}>Leads{arrow('leadsReceived')}</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('qualificationRate')}>Qual%{arrow('qualificationRate')}</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('closeRate')}>Close%{arrow('closeRate')}</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('avgDealSize')}>Gem. deal{arrow('avgDealSize')}</th>
              <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('commissionBooked')}>Comm. MTD{arrow('commissionBooked')}</th>

              <th style={{ ...th, textAlign: 'right', cursor: 'default' }} onClick={() => toggleSort('lastActivity')} title="Wanneer het board voor het laatst is bijgewerkt (inclusief onze syncs en Zapier). Contractor-activiteit specifiek volgt in een later fase.">Laatste board-update{arrow('lastActivity')}</th>
              <th style={{ ...th, cursor: 'default' }}>Pakketten</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} style={{ ...td, textAlign: 'center', color: 'var(--color-ink-faint)', padding: '32px' }}>
                  Geen contractors gevonden
                </td>
              </tr>
            )}
            {sorted.map(c => {
              const health = HEALTH_META[c.health]

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
                  {/* Name + niche — neutral badge, no semantic color */}
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{c.name}</span>
                      <span style={{
                        fontSize:     'var(--font-size-2xs)',
                        fontWeight:   500,
                        color:        'var(--color-ink-muted)',
                        background:   'var(--color-surface-raised)',
                        borderRadius: 'var(--radius-full)',
                        padding:      '1px 6px',
                        border:       '1px solid var(--color-border-subtle)',
                      }}>
                        {NICHE_LABEL[c.niche] ?? c.niche}
                      </span>
                    </div>
                  </td>

                  {/* Health */}
                  <td style={td}>
                    <Pill label={health.label} color={health.color} bg={health.bg} title={HEALTH_TOOLTIP[c.health]} />
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

                  {/* Leads */}
                  <td style={tdNum}>{c.leadsReceived || <Dash />}</td>

                  {/* Qual% */}
                  <td style={tdNum}>{fmtPct(c.qualificationRate)}</td>

                  {/* Close% */}
                  <td style={tdNum}>{fmtPct(c.closeRate)}</td>

                  {/* Avg deal size */}
                  <td style={tdNum}>{fmtEur(c.avgDealSize)}</td>

                  {/* Commission MTD */}
                  <td style={{ ...tdNum, color: c.commissionBooked > 0 ? 'var(--color-success)' : 'var(--color-ink-faint)' }}>
                    {fmtEur(c.commissionBooked)}
                  </td>

                  {/* Last activity */}
                  <td style={{ ...tdNum, color: 'var(--color-ink-muted)' }}>
                    {fmtAge(c.lastActivity)}
                  </td>

                  {/* Active packs */}
                  <td style={{ ...td, minWidth: 110 }}>
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ContractorPanel contractor={selectedContractor} onClose={closePanel} />
    </div>
  )
}
