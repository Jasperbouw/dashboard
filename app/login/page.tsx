'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const from         = searchParams.get('from') || '/'

  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const r = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })

    setLoading(false)

    if (r.ok) {
      router.replace(from)
      router.refresh()
    } else {
      setError('Ongeldig wachtwoord — probeer opnieuw')
      setPassword('')
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'var(--color-canvas)',
      padding:        '24px',
    }}>
      <div style={{
        width:        '100%',
        maxWidth:     340,
        display:      'flex',
        flexDirection:'column',
        gap:          28,
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize:   'var(--font-size-sm)',
            fontWeight: 700,
            color:      'var(--color-ink)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            BOUW CHECK
          </div>
          <div style={{
            fontSize:  'var(--font-size-xs)',
            color:     'var(--color-ink-faint)',
            marginTop: 4,
          }}>
            Command Center
          </div>
        </div>

        {/* Card */}
        <div style={{
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding:      '28px 24px',
          display:      'flex',
          flexDirection:'column',
          gap:          16,
        }}>
          <div style={{
            fontSize:   'var(--font-size-sm)',
            fontWeight: 500,
            color:      'var(--color-ink)',
          }}>
            Inloggen
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Wachtwoord"
              autoFocus
              autoComplete="current-password"
              style={{
                padding:      '9px 12px',
                background:   'var(--color-surface-raised)',
                border:       `1px solid ${error ? 'var(--color-critical)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                color:        'var(--color-ink)',
                fontSize:     'var(--font-size-sm)',
                outline:      'none',
                width:        '100%',
                transition:   'border-color 0.15s',
              }}
            />

            {error && (
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color:    'var(--color-critical)',
                lineHeight: 1.4,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                padding:      '9px',
                background:   'var(--color-accent)',
                color:        '#fff',
                border:       'none',
                borderRadius: 'var(--radius-md)',
                cursor:       loading || !password ? 'default' : 'pointer',
                fontSize:     'var(--font-size-sm)',
                fontWeight:   500,
                opacity:      loading || !password ? 0.55 : 1,
                transition:   'opacity 0.15s',
                width:        '100%',
              }}
            >
              {loading ? 'Bezig…' : 'Inloggen'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
