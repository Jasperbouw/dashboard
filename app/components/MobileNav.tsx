'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Handshake, Leaf, Wallet, TrendingUp } from 'lucide-react'

const NAV = [
  { href: '/',          label: 'Home',      Icon: LayoutDashboard },
  { href: '/deals',     label: 'Deals',     Icon: Handshake       },
  { href: '/greenteam', label: 'GreenTeam', Icon: Leaf            },
  { href: '/finance',   label: 'Finance',   Icon: Wallet          },
  { href: '/funnel',    label: 'Funnel',    Icon: TrendingUp      },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="mobile-nav-bar" style={{
      position:       'fixed',
      bottom:         0,
      left:           0,
      right:          0,
      height:         56,
      background:     'var(--color-surface-raised)',
      borderTop:      '1px solid var(--color-border)',
      alignItems:     'stretch',
      justifyContent: 'space-around',
      zIndex:         100,
      paddingBottom:  'env(safe-area-inset-bottom)',
    }}>
      {NAV.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link key={href} href={href} style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            3,
            flex:           1,
            textDecoration: 'none',
            color:          active ? 'var(--color-ink)' : 'var(--color-ink-faint)',
            transition:     'color 0.1s',
          }}>
            <Icon size={20} strokeWidth={active ? 2 : 1.75} />
            <span style={{ fontSize: '0.625rem', fontWeight: active ? 600 : 400, lineHeight: 1 }}>
              {label}
            </span>
            {active && (
              <span style={{
                position:   'absolute',
                bottom:     0,
                width:      28,
                height:     2,
                borderRadius: '2px 2px 0 0',
                background: 'var(--color-quote)',
              }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
