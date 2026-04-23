'use client'

import { useEffect, useState } from 'react'

interface Props {
  syncedAt: string | null  // ISO string from latest sync_run
}

function fmtAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  if (mins < 1)  return 'zojuist'
  if (mins < 60) return `${mins} min geleden`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}u geleden`
  return `${Math.floor(hrs / 24)}d geleden`
}

function staleness(iso: string): 'ok' | 'warning' | 'critical' {
  const mins = (Date.now() - new Date(iso).getTime()) / 60_000
  if (mins > 120) return 'critical'
  if (mins > 30)  return 'warning'
  return 'ok'
}

const COLOR: Record<'ok' | 'warning' | 'critical', string> = {
  ok:       'var(--color-ink-faint)',
  warning:  'var(--color-warning)',
  critical: 'var(--color-critical)',
}

export function LastSynced({ syncedAt }: Props) {
  const [, tick] = useState(0)

  // Re-render every 60s so relative label stays fresh
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!syncedAt) {
    return (
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-faint)' }}>
        · Nooit gesynchroniseerd
      </span>
    )
  }

  const level = staleness(syncedAt)
  const color = COLOR[level]

  return (
    <span style={{ fontSize: 'var(--font-size-xs)', color }} title={new Date(syncedAt).toLocaleString('nl-NL')}>
      · Laatste sync: {fmtAgo(syncedAt)}
    </span>
  )
}
