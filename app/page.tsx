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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f4f6f9' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, flexShrink: 0, background: '#ffffff',
        borderRight: '1px solid #e8ecf0', display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #e8ecf0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#6366f1', marginBottom: 4 }}>
            BOUW CHECK
          </div>
          <div style={{ fontSize: 11, color: '#374151' }}>Command Center</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 10, color: '#10b981' }}>Alle systemen actief</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8,
                fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                background: activeTab === item.id ? '#eef2ff' : 'transparent',
                color: activeTab === item.id ? '#4f46e5' : '#111827',
                border: activeTab === item.id ? '1px solid #c7d2fe' : '1px solid transparent',
                fontWeight: activeTab === item.id ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8ecf0' }}>
          <div style={{ fontSize: 11, color: '#374151' }}>Jasper van Heyningen</div>
          {time && <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{time}</div>}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', padding: 28 }}>
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
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: 0 }}>Client Map</h1>
        <p style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>B2B aannemers overzicht</p>
      </div>
      <div style={{ background: '#ffffff', border: '1px solid #e8ecf0', borderRadius: 12, overflow: 'hidden', height: 'calc(100vh - 148px)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <iframe src="/client-map.html" style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    </div>
  )
}
