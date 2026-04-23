'use client'

import { useState, useEffect } from 'react'

export function SidebarClock() {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    setTime(fmt())
    const t = setInterval(() => setTime(fmt()), 30_000)
    return () => clearInterval(t)
  }, [])

  if (!time) return null

  return (
    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)', marginTop: 2 }}>
      {time}
    </div>
  )
}
