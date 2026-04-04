'use client'

import { useState, useRef, useEffect } from 'react'

/* ── Types ── */
type AgentId = 'weekly' | 'finance' | 'ads_spy'

type AgentDef = {
  id: AgentId
  label: string
  icon: string
  description: string
  extraFields?: { key: string; label: string; placeholder: string }[]
}

const AGENTS: AgentDef[] = [
  {
    id: 'weekly',
    icon: '📊',
    label: 'Weekly Digest',
    description: 'Wekelijkse business briefing — alles in één overzicht.',
  },
  {
    id: 'finance',
    icon: '💶',
    label: 'Finance Adviseur',
    description: 'Analyseert maandcijfers, targets en contractstatus.',
  },
  {
    id: 'ads_spy',
    icon: '🔍',
    label: 'Ads Spy Agent',
    description: 'Competitive intelligence voor Meta advertenties in een branche.',
    extraFields: [
      { key: 'branche', label: 'Branche',           placeholder: 'bijv. zonnepanelen, badkamer…' },
      { key: 'vraag',   label: 'Onderzoeksvraag',   placeholder: 'bijv. welke hooks werken het best?' },
    ],
  },
]

/* ── localStorage helpers ── */
function loadCompanies(): any[] {
  try { return JSON.parse(localStorage.getItem('bouwcheck_companies_v3') || '[]') } catch { return [] }
}
function loadMonthly(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem('bouwcheck_monthly_v1') || '{}') } catch { return {} }
}
function loadTargets(): any {
  try { return JSON.parse(localStorage.getItem('bouwcheck_finance_targets') || '{}') } catch { return {} }
}
function loadCampaigns(): any[] {
  try {
    const raw = JSON.parse(localStorage.getItem('bouwcheck_meta_import') || 'null')
    if (!raw) return []
    return Array.isArray(raw) ? raw : (raw.campaigns || [])
  } catch { return [] }
}

function thisMonth() {
  return new Date().toISOString().slice(0, 7)
}

function buildContext(agentId: AgentId, extra: Record<string, string>) {
  const companies = loadCompanies()
  const monthly = loadMonthly()
  const targets = loadTargets()
  const month = thisMonth()

  const companiesWithActuals = companies.map((c: any) => {
    const key = `${c.id}_${month}`
    const entry = monthly[key] || { monthlyFee: 0, revenueGenerated: 0, leadsReceived: 0 }
    return {
      name: c.name,
      division: c.division,
      adBudget: c.adBudget,
      target: c.ownRevenueTarget,
      clientTarget: c.clientRevenueTarget,
      leadsTarget: c.leadsTarget,
      fee: entry.monthlyFee,
      revenueGenerated: entry.revenueGenerated,
      leadsReceived: entry.leadsReceived,
    }
  })

  const totalOwn = companiesWithActuals.reduce((s: number, c: any) => s + c.fee, 0)
  const totalClient = companiesWithActuals.reduce((s: number, c: any) => s + c.revenueGenerated, 0)
  const ownTarget = targets.ownTarget || companiesWithActuals.reduce((s: number, c: any) => s + c.target, 0)
  const clientTarget = targets.clientTarget || 0

  if (agentId === 'finance') {
    return { month, companies: companiesWithActuals, totalOwn, totalClient, ownTarget, clientTarget }
  }

  if (agentId === 'ads_spy') {
    return { branche: extra.branche || '', vraag: extra.vraag || '' }
  }

  if (agentId === 'weekly') {
    const campaigns = loadCampaigns()
    const metaSpend = campaigns.reduce((s: number, c: any) => s + (c.spend || 0), 0).toFixed(2)
    const metaLeads = campaigns.reduce((s: number, c: any) => s + (c.leads || 0), 0)
    const metaCPL = metaLeads > 0 ? (Number(metaSpend) / metaLeads).toFixed(2) : null
    const nearFull = companiesWithActuals
      .filter((c: any) => c.leadsTarget > 0 && c.leadsReceived / c.leadsTarget > 0.8)
      .map((c: any) => c.name)
    return {
      month,
      companies: companiesWithActuals,
      totalOwn,
      totalClient,
      ownTarget,
      clientTarget,
      companyCount: companies.length,
      nearFull,
      metaSpend: Number(metaSpend) > 0 ? metaSpend : null,
      metaLeads: metaLeads > 0 ? metaLeads : null,
      metaCPL,
    }
  }

  return {}
}

/* ── Simple markdown renderer ── */
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', margin: '20px 0 8px' }}>{parseInline(line.slice(2))}</h1>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: 15, fontWeight: 600, color: '#c4b5fd', margin: '16px 0 6px' }}>{parseInline(line.slice(3))}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', margin: '12px 0 4px' }}>{parseInline(line.slice(4))}</h3>)
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(<p key={i} style={{ margin: '4px 0', color: '#cbd5e0', fontSize: 13, paddingLeft: 4 }}>{parseInline(line)}</p>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<p key={i} style={{ margin: '3px 0', color: '#cbd5e0', fontSize: 13, paddingLeft: 12 }}>{'• '}{parseInline(line.slice(2))}</p>)
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />)
    } else {
      elements.push(<p key={i} style={{ margin: '3px 0', color: '#a0aec0', fontSize: 13 }}>{parseInline(line)}</p>)
    }
    i++
  }
  return elements
}

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#e2e8f0', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: '#1a1a2e', padding: '1px 5px', borderRadius: 3, fontSize: 12, color: '#a78bfa' }}>{part.slice(1, -1)}</code>
    }
    return part
  })
}

/* ── Main component ── */
export default function AgentsTab() {
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('weekly')
  const [extra, setExtra] = useState<Record<string, string>>({})
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const outputRef = useRef<HTMLDivElement>(null)

  const agent = AGENTS.find(a => a.id === selectedAgent)!

  // Reset extra fields when switching agents
  useEffect(() => { setExtra({}); setOutput(''); setError('') }, [selectedAgent])

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [output])

  async function runAgent() {
    setLoading(true)
    setOutput('')
    setError('')
    try {
      const context = buildContext(selectedAgent, extra)
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType: selectedAgent, context }),
      })
      if (!res.ok || !res.body) {
        setError('API fout — controleer je ANTHROPIC_API_KEY in .env.local')
        setLoading(false)
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setOutput(prev => prev + dec.decode(value))
      }
    } catch (e: any) {
      setError(e.message || 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  const canRun = !loading && (!agent.extraFields || agent.extraFields.every(f => f.key === 'context' || !!extra[f.key]))

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 56px)' }}>

      {/* ── Left panel: agent selector + inputs ── */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ marginBottom: 4 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>AI Agents</h1>
          <p style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>Claude-powered business intelligence</p>
        </div>

        {/* Agent list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {AGENTS.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a.id)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                background: selectedAgent === a.id ? '#1a1a2e' : 'transparent',
                border: selectedAgent === a.id ? '1px solid #6366f1' : '1px solid #1a1a2e',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{a.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: selectedAgent === a.id ? '#e2e8f0' : '#718096' }}>{a.label}</span>
              </div>
              {selectedAgent === a.id && (
                <p style={{ fontSize: 11, color: '#4a5568', marginTop: 5, marginBottom: 0, lineHeight: 1.4 }}>{a.description}</p>
              )}
            </button>
          ))}
        </div>

        {/* Extra fields */}
        {agent.extraFields && agent.extraFields.length > 0 && (
          <div style={{ background: '#111118', border: '1px solid #1a1a2e', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {agent.extraFields.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: '#718096', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input
                  value={extra[f.key] || ''}
                  onChange={e => setExtra(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12,
                    background: '#0d0d15', border: '1px solid #252540', color: '#e2e8f0',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Run button */}
        <button
          onClick={runAgent}
          disabled={!canRun}
          style={{
            padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: canRun ? 'pointer' : 'not-allowed',
            background: canRun ? '#6366f1' : '#1a1a2e',
            color: canRun ? '#fff' : '#4a5568',
            border: 'none', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Genereren…
            </>
          ) : (
            <>{agent.icon} Start {agent.label}</>
          )}
        </button>

        {/* Data hint */}
        <p style={{ fontSize: 10, color: '#2d3748', lineHeight: 1.5, marginTop: 4 }}>
          {(['weekly', 'finance', 'branch'].includes(selectedAgent)) && 'Haalt data op uit Finance tab. '}
          {(['weekly', 'meta'].includes(selectedAgent)) && 'Haalt campagnedata op uit Meta tab. '}
        </p>
      </div>

      {/* ── Right panel: output ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          ref={outputRef}
          style={{
            flex: 1, background: '#0d0d15', border: '1px solid #1a1a2e', borderRadius: 12,
            padding: '20px 24px', overflowY: 'auto',
          }}
        >
          {error && (
            <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>
            </div>
          )}

          {!output && !loading && !error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <span style={{ fontSize: 48 }}>{agent.icon}</span>
              <p style={{ color: '#4a5568', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>{agent.description}</p>
              <p style={{ color: '#2d3748', fontSize: 12, textAlign: 'center' }}>Klik op "Start {agent.label}" om te beginnen</p>
            </div>
          )}

          {loading && !output && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#4a5568' }}>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #252540', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Claude analyseert…</span>
            </div>
          )}

          {output && (
            <div>
              {renderMarkdown(output)}
              {loading && (
                <span style={{ display: 'inline-block', width: 8, height: 14, background: '#6366f1', marginLeft: 2, animation: 'blink 1s step-end infinite' }} />
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}
