'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, Building2,
  Wallet, Image,
} from 'lucide-react'

const NAV = [
  { href: '/',            label: 'Today',       Icon: LayoutDashboard },
  { href: '/funnel',      label: 'Funnel',      Icon: TrendingUp      },
  { href: '/contractors', label: 'Contractors', Icon: Building2       },
  { href: '/finance',     label: 'Finance',     Icon: Wallet          },
  { href: '/creatives',   label: 'Creatives',   Icon: Image           },
]

export function NavItems() {
  const pathname = usePathname()

  return (
    <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {NAV.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              padding:        '8px 10px',
              borderRadius:   'var(--radius-md)',
              fontSize:       'var(--font-size-sm)',
              fontWeight:     active ? 500 : 400,
              color:          active ? 'var(--color-ink)' : 'var(--color-ink-muted)',
              background:     active ? 'var(--color-surface-raised)' : 'transparent',
              border:         active ? '1px solid var(--color-border-strong)' : '1px solid transparent',
              textDecoration: 'none',
              transition:     'color 0.1s, background 0.1s',
              position:       'relative',
            }}
          >
            {/* Active dot */}
            <span style={{
              width:        5,
              height:       5,
              borderRadius: '50%',
              background:   active ? 'var(--color-quote)' : 'transparent',
              flexShrink:   0,
              transition:   'background 0.1s',
            }} />

            <Icon
              size={15}
              strokeWidth={active ? 2 : 1.75}
              style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}
            />

            {label}
          </Link>
        )
      })}
    </nav>
  )
}
