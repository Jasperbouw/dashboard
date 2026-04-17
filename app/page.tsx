'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const CreativesTab = dynamic(() => import('./components/CreativesTab'), { ssr: false })
const FinanceTab = dynamic(() => import('./components/FinanceTab'), { ssr: false })
const DocsTab    = dynamic(() => import('./components/DocsTab'),    { ssr: false })

const NAV_ITEMS = [
  { id: 'finance',   label: 'Finance',    icon: '◆' },
  { id: 'creatives', label: 'Creatives',  icon: '◈' },
  { id: 'map',       label: 'Client Map', icon: '◉' },
  { id: 'docs',      label: 'Docs',       icon: '▤' },
]

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('finance')

  useEffect(() => {
    const saved = localStorage.getItem('bouwcheck_active_tab')
    if (saved) setActiveTab(saved)
  }, [])
  const [time, setTime] = useState('')

  function handleTabChange(id: string) {
    setActiveTab(id)
    localStorage.setItem('bouwcheck_active_tab', id)
  }

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    setTime(fmt())
    const t = setInterval(() => setTime(fmt()), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 216, flexShrink: 0, background: '#0f172a',
        display: 'flex', flexDirection: 'column', zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: '#ffffff', marginBottom: 2 }}>
            BOUW CHECK
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Command Center</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 10, color: '#4ade80' }}>Alle systemen actief</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8,
                fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                background: activeTab === item.id ? '#4f46e5' : 'transparent',
                color: activeTab === item.id ? '#ffffff' : '#94a3b8',
                border: 'none',
                fontWeight: activeTab === item.id ? 600 : 400,
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>Jasper van Heyningen</div>
          {time && <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{time}</div>}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        {activeTab === 'creatives' && <CreativesTab />}
        {activeTab === 'finance' && <FinanceTab />}
        {activeTab === 'docs'    && <DocsTab />}
        {activeTab === 'map'     && <MapTab />}
      </main>
    </div>
  )
}

function MapTab() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Client Map</h1>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>B2B aannemers overzicht</p>
      </div>
      <div style={{ background: '#ffffff', borderRadius: 12, overflow: 'hidden', height: 'calc(100vh - 148px)', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)' }}>
        <iframe src="/client-map.html" style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    </div>
  )
}
