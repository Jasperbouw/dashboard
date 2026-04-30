'use client'

import { useState } from 'react'
import type { EnrichedAlert } from '../../../lib/alerts/queries'

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Kritiek',
  warning:  'Aandacht',
  info:     'Info',
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--color-critical)',
  warning:  'var(--color-warning)',
  info:     'var(--color-info)',
}

const SEVERITY_BG: Record<string, string> = {
  critical: 'var(--color-critical-subtle)',
  warning:  'var(--color-warning-subtle)',
  info:     'var(--color-info-subtle)',
}

const TYPE_LABELS: Record<string, string> = {
  stale_quote:             'Verlopen offerte',
  overdue_followup:        'Opvolging te laat',
  low_close_rate:          'Lage sluitingsratio',
  slow_lead_processing:    'Lead niet opgepakt',
  aging_quote:             'Verouderde offerte',
  low_qualification_rate:  'Lage kwalificatieratio',
  followup_due_today:      'Follow-up vandaag',
  unrouted_leads_backlog:  'Onbekende leads',
  new_deal_won:            'Deal gewonnen',
  new_quote_sent:          'Offerte verstuurd',
  retainer_at_risk:        'Retainer in gevaar',
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1)  return 'zojuist'
  if (h < 24) return `${h}u geleden`
  const d = Math.floor(h / 24)
  return `${d}d geleden`
}

interface Props {
  initialAlerts: EnrichedAlert[]
}

export function AlertsFeed({ initialAlerts }: Props) {
  const [alerts, setAlerts]     = useState(initialAlerts)
  const [dismissing, setDismiss] = useState<Set<string>>(new Set())

  async function dismiss(id: string) {
    setDismiss(prev => new Set(prev).add(id))
    try {
      await fetch(`/api/alerts/${id}/dismiss`, { method: 'POST' })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } finally {
      setDismiss(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const bySeverity = ['critical', 'warning', 'info'].map(sev => ({
    sev,
    items: alerts.filter(a => a.severity === sev),
  })).filter(g => g.items.length > 0)

  if (alerts.length === 0) {
    return (
      <div style={{
        textAlign:  'center',
        padding:    '48px 0',
        color:      'var(--color-ink-faint)',
        fontSize:   'var(--font-size-sm)',
      }}>
        ✓ Geen actieve meldingen
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {bySeverity.map(({ sev, items }) => (
        <div key={sev}>
          {/* Severity header */}
          <div style={{
            display:     'flex',
            alignItems:  'center',
            gap:         8,
            marginBottom: 8,
          }}>
            <span style={{
              display:      'inline-block',
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   SEVERITY_COLOR[sev],
              flexShrink:   0,
            }} />
            <span style={{
              fontSize:   'var(--font-size-xs)',
              fontWeight: 600,
              color:      SEVERITY_COLOR[sev],
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {SEVERITY_LABEL[sev]} ({items.length})
            </span>
          </div>

          {/* Alert rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {items.map(alert => {
              const actionUrl = alert.lead_id
                ? `https://monday.com/boards/${alert.meta?.board_id ?? ''}`
                : undefined
              const isDismissing = dismissing.has(alert.id)

              return (
                <div
                  key={alert.id}
                  style={{
                    display:      'flex',
                    alignItems:   'flex-start',
                    gap:          12,
                    padding:      '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background:   'var(--color-surface)',
                    border:       '1px solid var(--color-border)',
                    opacity:      isDismissing ? 0.5 : 1,
                    transition:   'opacity 0.15s',
                  }}
                >
                  {/* Severity dot */}
                  <span style={{
                    marginTop:    4,
                    width:        7,
                    height:       7,
                    borderRadius: '50%',
                    background:   SEVERITY_COLOR[sev],
                    flexShrink:   0,
                  }} />

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize:   'var(--font-size-sm)',
                        fontWeight: 500,
                        color:      'var(--color-ink)',
                      }}>
                        {alert.title}
                      </span>
                      <span style={{
                        fontSize:      'var(--font-size-2xs)',
                        color:         'var(--color-ink-faint)',
                        background:    'var(--color-surface-raised)',
                        borderRadius:  'var(--radius-sm)',
                        padding:       '1px 5px',
                        whiteSpace:    'nowrap',
                      }}>
                        {TYPE_LABELS[alert.type] ?? alert.type}
                      </span>
                    </div>
                    <div style={{
                      fontSize:  'var(--font-size-xs)',
                      color:     'var(--color-ink-muted)',
                      marginTop: 2,
                    }}>
                      {alert.body}
                      {alert.contractor && (
                        <span style={{ color: 'var(--color-ink-faint)', marginLeft: 6 }}>
                          — {alert.contractor.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Age + actions */}
                  <div style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        8,
                    flexShrink: 0,
                  }}>
                    <span
                      style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}
                      title={`Gedetecteerd: ${new Date(alert.triggered_at).toLocaleDateString('nl-NL')}`}
                    >
                      {formatAge(alert.issue_started_at ?? alert.triggered_at)}
                    </span>

                    <button
                      onClick={() => dismiss(alert.id)}
                      disabled={isDismissing}
                      style={{
                        fontSize:   'var(--font-size-xs)',
                        color:      'var(--color-ink-faint)',
                        background: 'transparent',
                        border:     'none',
                        cursor:     isDismissing ? 'default' : 'pointer',
                        padding:    '2px 4px',
                        lineHeight: 1,
                      }}
                      title="Verberg melding"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
