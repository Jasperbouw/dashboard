'use client'

import { NavItems } from './NavItems'
import { SidebarClock } from './SidebarClock'

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

export function Sidebar() {
  return (
    <aside style={{
      width:         240,
      flexShrink:    0,
      height:        '100vh',
      display:       'flex',
      flexDirection: 'column',
      background:    'var(--color-surface-raised)',
      borderRight:   '1px solid var(--color-border)',
      position:      'sticky',
      top:           0,
      overflow:      'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding:      '20px 18px 16px',
        borderBottom: '1px solid var(--color-border-subtle)',
        flexShrink:   0,
      }}>
        <div style={{
          fontSize:   'var(--font-size-sm)',
          fontWeight: 600,
          color:      'var(--color-ink)',
          lineHeight: 1.3,
        }}>
          BOUW CHECK
        </div>
        <div style={{
          fontSize:   'var(--font-size-xs)',
          color:      'var(--color-ink-muted)',
          marginTop:  3,
        }}>
          Command Center
        </div>

        {/* System status */}
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        6,
          marginTop:  12,
        }}>
          <span style={{
            width:        6,
            height:       6,
            borderRadius: '50%',
            background:   'var(--color-success)',
            flexShrink:   0,
          }} />
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-ink-faint)' }}>
            Alle systemen actief
          </span>
        </div>
      </div>

      {/* Navigation */}
      <NavItems />

      {/* Footer */}
      <div style={{
        padding:     '16px 18px 24px',
        borderTop:   '1px solid var(--color-border-subtle)',
        flexShrink:  0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-ink)' }}>
            Jasper van Heyningen
          </div>
          <button
            onClick={logout}
            style={{
              background:   'none',
              border:       'none',
              cursor:       'pointer',
              fontSize:     'var(--font-size-2xs)',
              color:        'var(--color-ink-faint)',
              padding:      '2px 6px',
              borderRadius: 'var(--radius-sm)',
              flexShrink:   0,
              lineHeight:   1.4,
            }}
            title="Uitloggen"
          >
            Uitloggen
          </button>
        </div>
        <SidebarClock />
      </div>
    </aside>
  )
}
