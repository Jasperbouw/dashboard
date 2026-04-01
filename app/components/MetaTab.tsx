'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { dbGet, dbSet } from '../../lib/db'

/* ── Types ── */
type Campaign = {
  name: string
  status: string
  spend: number
  impressions: number
  reach: number
  frequency: number
  clicks: number
  ctr: number
  cpm: number
  leads: number
  cpl: number | null
}

type MetaData = {
  campaigns: Campaign[]
  importedAt: string
  period: string
}

type SubTab = 'campagnes' | 'audit' | 'strategie'

/* ── CSV parser ── */
const COL_MAP: Record<string, keyof Campaign> = {
  // English
  'campaign name': 'name',
  'delivery': 'status',
  'amount spent (eur)': 'spend',
  'amount spent (usd)': 'spend',
  'impressions': 'impressions',
  'reach': 'reach',
  'frequency': 'frequency',
  'link clicks': 'clicks',
  'ctr (link click-through rate)': 'ctr',
  'cpm (cost per 1,000 impressions)': 'cpm',
  'results': 'leads',
  'cost per result': 'cpl',
  // Dutch
  'campagnenaam': 'name',
  'levering': 'status',
  'besteed bedrag (eur)': 'spend',
  'vertoningen': 'impressions',
  'bereik': 'reach',
  'frequentie': 'frequency',
  'linkkliks': 'clicks',
  'ctr (klikfrequentie link)': 'ctr',
  'cpm (kosten per 1000 vertoningen)': 'cpm',
  'resultaten': 'leads',
  'kosten per resultaat': 'cpl',
}

function parseNum(s: string): number {
  if (!s || s === '-' || s === '') return 0
  return parseFloat(s.replace(/[€$£,\s]/g, '').replace(',', '.')) || 0
}

function parseMetaCSV(text: string): Campaign[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  // Find header row (contains 'campaign' or 'campagne')
  const headerIdx = lines.findIndex(l => /campaign|campagne/i.test(l))
  if (headerIdx === -1) return []

  const headers = lines[headerIdx].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())
  const colIdx: Partial<Record<keyof Campaign, number>> = {}
  headers.forEach((h, i) => {
    const key = COL_MAP[h]
    if (key) colIdx[key] = i
  })

  const campaigns: Campaign[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
    if (!row[colIdx.name ?? 0]) continue
    // Skip totals / footer rows
    if (/^total|^totaal/i.test(row[0])) continue
    const get = (key: keyof Campaign) => row[colIdx[key] ?? -1] ?? ''
    campaigns.push({
      name: get('name') || '—',
      status: get('status') || 'ACTIVE',
      spend: parseNum(get('spend')),
      impressions: parseNum(get('impressions')),
      reach: parseNum(get('reach')),
      frequency: parseNum(get('frequency')),
      clicks: parseNum(get('clicks')),
      ctr: parseNum(get('ctr')),
      cpm: parseNum(get('cpm')),
      leads: parseNum(get('leads')),
      cpl: get('cpl') && get('cpl') !== '-' ? parseNum(get('cpl')) : null,
    })
  }
  return campaigns.filter(c => c.name !== '—' || c.spend > 0)
}

/* ── Helpers ── */
function eur(n: number, dec = 0) {
  return '€' + n.toLocaleString('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toLocaleString('nl-NL')
}
function cplColor(cpl: number | null) {
  if (!cpl) return '#4a5568'
  if (cpl <= 4) return '#10b981'
  if (cpl <= 7) return '#f59e0b'
  return '#ef4444'
}

const CARD = { background: '#111118', border: '1px solid #1a1a2e', borderRadius: 12, padding: '16px 20px' } as const
const SUB_NAV = ['campagnes', 'audit', 'strategie'] as const

/* ════════════════════════════════════════════════════════ */
export default function MetaTab() {
  const [sub, setSub] = useState<SubTab>('campagnes')
  const [metaData, setMetaData] = useState<MetaData | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    dbGet('bouwcheck_meta_import').then(val => { if (val) setMetaData(val) })
  }, [])

  const handleFile = useCallback((file: File) => {
    setError('')
    if (!file.name.endsWith('.csv')) { setError('Alleen CSV bestanden worden ondersteund.'); return }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const campaigns = parseMetaCSV(text)
      if (campaigns.length === 0) { setError('Geen campagnes gevonden. Zorg dat je een Meta Ads Manager rapport exporteert.'); return }
      const data: MetaData = {
        campaigns,
        importedAt: new Date().toLocaleString('nl-NL'),
        period: 'Geïmporteerd uit CSV',
      }
      setMetaData(data)
      dbSet('bouwcheck_meta_import', data)
    }
    reader.readAsText(file)
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      {/* Header + sub-nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Meta Ads</h1>
          <p style={{ fontSize: 12, color: '#4a5568', marginTop: 4 }}>
            {metaData ? `Geïmporteerd op ${metaData.importedAt}` : 'Importeer een CSV uit Ads Manager'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SUB_NAV.map(s => (
            <button key={s} onClick={() => setSub(s)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: sub === s ? '#6366f120' : 'transparent',
                border: `1px solid ${sub === s ? '#6366f1' : '#1a1a2e'}`,
                color: sub === s ? '#6366f1' : '#4a5568',
              }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {sub === 'campagnes' && (
        <CampagnesTab
          data={metaData}
          dragging={dragging}
          error={error}
          inputRef={inputRef}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onFileChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          onClickUpload={() => inputRef.current?.click()}
        />
      )}
      {sub === 'audit' && <AuditTab />}
      {sub === 'strategie' && <StrategieTab />}
    </div>
  )
}

/* ── Campagnes tab ── */
function CampagnesTab({ data, dragging, error, inputRef, onDrop, onDragOver, onDragLeave, onFileChange, onClickUpload }: {
  data: MetaData | null; dragging: boolean; error: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClickUpload: () => void
}) {
  const campaigns = data?.campaigns ?? []
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0)
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
  const avgCPM = campaigns.filter(c => c.cpm > 0).reduce((s, c, _, a) => s + c.cpm / a.length, 0)

  const chartData = [...campaigns]
    .filter(c => c.leads > 0)
    .sort((a, b) => (a.cpl ?? 99) - (b.cpl ?? 99))
    .slice(0, 8)
    .map(c => ({ name: c.name.length > 22 ? c.name.slice(0, 22) + '…' : c.name, cpl: c.cpl ?? 0, spend: c.spend, leads: c.leads }))

  return (
    <div>
      {/* Upload zone */}
      <div
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onClick={onClickUpload}
        style={{
          border: `2px dashed ${dragging ? '#6366f1' : '#1a1a2e'}`,
          borderRadius: 12, padding: '20px 24px', marginBottom: 16, cursor: 'pointer',
          background: dragging ? '#6366f110' : 'transparent',
          display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.15s',
        }}>
        <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileChange} />
        <div style={{ fontSize: 22 }}>📥</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>
            {data ? 'Nieuw rapport importeren' : 'CSV rapport importeren'}
          </div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>
            Exporteer in Ads Manager → Rapporten → CSV downloaden · Sleep hier of klik
          </div>
        </div>
        {data && (
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#10b981', whiteSpace: 'nowrap' }}>
            ✓ {campaigns.length} campagnes geladen
          </div>
        )}
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {campaigns.length > 0 && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
            {[
              { label: 'Totaal besteed',  value: eur(totalSpend),                                color: '#6366f1' },
              { label: 'Totaal leads',    value: num(totalLeads),                                color: '#10b981' },
              { label: 'Gem. CPL',        value: avgCPL > 0 ? eur(avgCPL, 2) : '—',             color: avgCPL > 0 ? cplColor(avgCPL) : '#4a5568' },
              { label: 'Gem. CPM',        value: avgCPM > 0 ? eur(avgCPM, 2) : '—',             color: '#38bdf8' },
            ].map(k => (
              <div key={k.label} style={CARD}>
                <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* CPL chart */}
          {chartData.length > 0 && (
            <div style={{ ...CARD, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#8896a8', marginBottom: 14 }}>CPL per campagne (laag → hoog)</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <XAxis type="number" tick={{ fill: '#4a5568', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#8896a8', fontSize: 10 }} axisLine={false} tickLine={false} width={155} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                    formatter={(v: unknown) => [`€${(v as number).toFixed(2)}`, 'CPL']}
                  />
                  <Bar dataKey="cpl" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {chartData.map((c, i) => <Cell key={i} fill={cplColor(c.cpl)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Campaign table */}
          <div style={{ background: '#111118', border: '1px solid #1a1a2e', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                  {['Campagne', 'Besteed', 'Impressies', 'Bereik', 'Freq', 'CTR', 'CPM', 'Leads', 'CPL'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 500, color: '#4a5568', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...campaigns].sort((a, b) => b.spend - a.spend).map((c, i, arr) => (
                  <tr key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid #0f0f1a' : 'none' }}>
                    <td style={{ padding: '8px 14px', fontWeight: 500, color: '#e2e8f0', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>{c.name}</div>
                    </td>
                    <td style={{ padding: '8px 14px', color: '#6366f1', fontWeight: 600 }}>{eur(c.spend, 2)}</td>
                    <td style={{ padding: '8px 14px', color: '#8896a8' }}>{num(c.impressions)}</td>
                    <td style={{ padding: '8px 14px', color: '#8896a8' }}>{num(c.reach)}</td>
                    <td style={{ padding: '8px 14px', color: c.frequency >= 3 ? '#f59e0b' : '#8896a8' }}>{c.frequency.toFixed(2)}</td>
                    <td style={{ padding: '8px 14px', color: '#8896a8' }}>{c.ctr.toFixed(2)}%</td>
                    <td style={{ padding: '8px 14px', color: '#8896a8' }}>{c.cpm > 0 ? eur(c.cpm, 2) : '—'}</td>
                    <td style={{ padding: '8px 14px', color: '#10b981', fontWeight: 600 }}>{c.leads > 0 ? c.leads : '—'}</td>
                    <td style={{ padding: '8px 14px', fontWeight: c.cpl ? 600 : 400, color: cplColor(c.cpl) }}>
                      {c.cpl ? eur(c.cpl, 2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {campaigns.length === 0 && !error && (
        <div style={{ ...CARD, textAlign: 'center', padding: '48px 32px', color: '#374151', fontSize: 13 }}>
          Importeer een CSV om je campagnedata te zien
        </div>
      )}
    </div>
  )
}

/* ── Audit tab ── */
const AUDIT_SCORES = [
  { label: 'Pixel / Tracking', score: 35, weight: '30%', color: '#ef4444' },
  { label: 'Creative',         score: 30, weight: '30%', color: '#ef4444' },
  { label: 'Account Structuur',score: 40, weight: '20%', color: '#ef4444' },
  { label: 'Audience & Targeting', score: 50, weight: '20%', color: '#f59e0b' },
]

const AUDIT_CAMPAIGNS = [
  { name: 'VL - C03 - Branche VL',    leads: 127, cpl: 2.84,  spend: 360.33,  ctr: '3.20%', freq: 2.87, trend: '✅ Improving',     verdict: 'scale' },
  { name: 'AC - C02 - Airco Twente',   leads: 109, cpl: 2.96,  spend: 322.58,  ctr: '2.63%', freq: 2.81, trend: '✅ Best performer', verdict: 'scale' },
  { name: 'AB - C04 - Aanbouw',        leads: 60,  cpl: 3.42,  spend: 205.10,  ctr: '1.18%', freq: 2.27, trend: '✅ Stable',         verdict: 'scale' },
  { name: 'DD - C05 - Plat',           leads: 108, cpl: 5.57,  spend: 601.88,  ctr: '1.46%', freq: 2.86, trend: '✅ Stable',         verdict: 'ok' },
  { name: 'PFAB - C01 - Bouw Check',   leads: 119, cpl: 6.20,  spend: 737.89,  ctr: '1.65%', freq: 2.86, trend: '✅ Stable',         verdict: 'ok' },
  { name: 'DK - C04 - DCN Page',       leads: 37,  cpl: 8.25,  spend: 305.32,  ctr: '1.07%', freq: 2.27, trend: 'Stable',           verdict: 'ok' },
  { name: 'DK - C05 - DCN Page',       leads: 35,  cpl: 8.78,  spend: 307.36,  ctr: '1.48%', freq: 2.51, trend: 'Stable',           verdict: 'ok' },
  { name: 'DD - C04 - Branche DD',     leads: 118, cpl: 10.23, spend: 1207.24, ctr: '1.43%', freq: 2.83, trend: '❌ +26% vs 8.14',   verdict: 'fix' },
  { name: 'DD - C01 - Branche',        leads: 44,  cpl: 10.39, spend: 457.09,  ctr: '1.87%', freq: 2.18, trend: '⚠️ Highest CPL',    verdict: 'fix' },
  { name: 'BK - C01 - Rotterdamse DK', leads: 19,  cpl: 10.98, spend: 208.71,  ctr: '1.61%', freq: 2.67, trend: '❌ +36% vs 8.08',   verdict: 'fix' },
]

const QUICK_WINS = [
  { action: 'Fix Events Manager custom event error', effort: '5 min', impact: 'Verwijdert blokkerende fout van account' },
  { action: 'Pauzeer "AD 1 – Copy 2" in DD-C04 (€11.30 CPL)', effort: '2 min', impact: 'Stop overpaying op slechtste creative' },
  { action: 'Upload video creative (beschikbare .mp4 bestanden) naar AC-C02 en VL-C03', effort: '30 min', impact: '2e formaat = betere Meta optimalisatie' },
  { action: 'Hernoem alle actieve ads met beschrijvende namen', effort: '1 uur', impact: 'Maakt data-gedreven creatieve beslissingen mogelijk' },
  { action: 'Bouw Lookalike 1% op basis van Lead Form converters', effort: '15 min', impact: 'Verbeter targeting signaalkwaliteit' },
  { action: 'Archiveer alle 40+ zero-spend campagnes', effort: '15 min', impact: 'Schoner account, geen per ongeluk heractivering' },
  { action: 'Voeg 4e en 5e ad toe aan PFAB-C01 (nu 4 ads)', effort: '1 uur', impact: 'Voldoet aan Meta\'s minimum van 5 ads' },
]

function AuditTab() {
  const totalScore = 37
  const gradeColor = '#ef4444'
  const period = '15 feb – 16 mrt 2026'
  const totalSpend = 4713
  const totalLeads = 776
  const blendedCPL = 6.07

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Health score */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
        <div style={{ ...CARD, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 8, letterSpacing: 1, fontWeight: 600 }}>HEALTH SCORE</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: gradeColor, lineHeight: 1 }}>{totalScore}</div>
          <div style={{ fontSize: 14, color: '#374151' }}>/100</div>
          <div style={{ marginTop: 8, padding: '3px 12px', background: gradeColor + '20', border: `1px solid ${gradeColor}40`, borderRadius: 4, fontSize: 12, color: gradeColor, fontWeight: 700 }}>Grade F</div>
          <div style={{ fontSize: 10, color: '#374151', marginTop: 8 }}>Rapport: 17 mrt 2026</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#8896a8', marginBottom: 14 }}>Score per categorie</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {AUDIT_SCORES.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: '#8896a8' }}>{s.label} <span style={{ color: '#374151', fontSize: 10 }}>({s.weight})</span></span>
                  <span style={{ color: s.color, fontWeight: 600 }}>{s.score}/100</span>
                </div>
                <div style={{ height: 5, background: '#1a1a2e', borderRadius: 3 }}>
                  <div style={{ height: 5, background: s.color, borderRadius: 3, width: `${s.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Period performance */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#8896a8' }}>Campagneprestaties — {period}</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <span style={{ color: '#4a5568' }}>Besteed: <span style={{ color: '#6366f1', fontWeight: 600 }}>{eur(totalSpend)}</span></span>
            <span style={{ color: '#4a5568' }}>Leads: <span style={{ color: '#10b981', fontWeight: 600 }}>{totalLeads}</span></span>
            <span style={{ color: '#4a5568' }}>Blended CPL: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{eur(blendedCPL, 2)}</span></span>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
              {['Campagne', 'Leads', 'CPL', 'Besteed', 'CTR', 'Freq', 'Trend'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '7px 12px', fontSize: 10, fontWeight: 500, color: '#4a5568' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AUDIT_CAMPAIGNS.map((c, i) => (
              <tr key={i} style={{ borderBottom: i < AUDIT_CAMPAIGNS.length - 1 ? '1px solid #0f0f1a' : 'none' }}>
                <td style={{ padding: '7px 12px', color: '#e2e8f0', fontWeight: 500, maxWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.verdict === 'scale' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0, display: 'inline-block' }} />}
                    {c.verdict === 'fix' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0, display: 'inline-block' }} />}
                    {c.verdict === 'ok' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#374151', flexShrink: 0, display: 'inline-block' }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ padding: '7px 12px', color: '#10b981', fontWeight: 600 }}>{c.leads}</td>
                <td style={{ padding: '7px 12px', fontWeight: 600, color: cplColor(c.cpl) }}>{eur(c.cpl, 2)}</td>
                <td style={{ padding: '7px 12px', color: '#6366f1' }}>{eur(c.spend, 2)}</td>
                <td style={{ padding: '7px 12px', color: '#8896a8' }}>{c.ctr}</td>
                <td style={{ padding: '7px 12px', color: c.freq >= 2.8 ? '#f59e0b' : '#8896a8' }}>{c.freq}</td>
                <td style={{ padding: '7px 12px', color: '#4a5568', fontSize: 11 }}>{c.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Critical alerts */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#8896a8', marginBottom: 14 }}>🔴 Kritieke alerts</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { title: 'Events Manager blokkerende fout', desc: 'Events Manager → Datasets → Pixel Noble Men → Review Events → bevestig ownership van custom events. Blokkeert account-level ad features.' },
            { title: 'DD-C04 CPL stijgt snel (+26%)', desc: '€40/dag budget, €1.207 in 30 dagen. CPL van €8.14 naar €10.23. Top ad "AD 1 – Copy 2" (70 leads, €11.30 CPL) heeft "Below average" kwaliteitsranking. Pauzeer direct en vervang creative.' },
            { title: 'BK-C01 CPL +36% in 30 dagen', desc: 'Van €8.08 naar €10.98. Slechts €15/dag budget — bijna zeker in "Learning Limited". Verhoog naar €60+/dag of consolideer in DD campagnes.' },
          ].map((a, i) => (
            <div key={i} style={{ background: '#ef444410', border: '1px solid #ef444430', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 11, color: '#8896a8', lineHeight: 1.5 }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick wins */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#8896a8', marginBottom: 14 }}>⚡ Quick wins deze week</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
              {['#', 'Actie', 'Tijd', 'Impact'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 10, fontWeight: 500, color: '#4a5568' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QUICK_WINS.map((w, i) => (
              <tr key={i} style={{ borderBottom: i < QUICK_WINS.length - 1 ? '1px solid #0f0f1a' : 'none' }}>
                <td style={{ padding: '7px 12px', color: '#374151', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ padding: '7px 12px', color: '#e2e8f0' }}>{w.action}</td>
                <td style={{ padding: '7px 12px', color: '#6366f1', whiteSpace: 'nowrap' }}>{w.effort}</td>
                <td style={{ padding: '7px 12px', color: '#8896a8', fontSize: 11 }}>{w.impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Strategie tab ── */
const PLATFORM_MIX = [
  { platform: 'Meta (FB/IG)',      role: 'B2C primary',   budget: '55%', cpl: '€25',  maxCpl: '€50',  color: '#6366f1' },
  { platform: 'Google Search',     role: 'B2C uitbreiden', budget: '35%', cpl: '€40',  maxCpl: '€75',  color: '#10b981' },
  { platform: 'Google Retargeting',role: 'B2C support',   budget: '10%', cpl: '€30',  maxCpl: '€60',  color: '#38bdf8' },
  { platform: 'LinkedIn',          role: 'B2B aannemers', budget: '60%*',cpl: '€60',  maxCpl: '€100', color: '#f59e0b' },
  { platform: 'Meta B2B',          role: 'B2B aannemers', budget: '40%*',cpl: '€30',  maxCpl: '€60',  color: '#e040fb' },
]

const SEASONS = [
  { month: 'Jan', mult: '0.7×', note: 'Testen', color: '#374151' },
  { month: 'Feb', mult: '0.8×', note: 'Opbouwen', color: '#374151' },
  { month: 'Mrt', mult: '1.2×', note: '🔥 Piek', color: '#10b981' },
  { month: 'Apr', mult: '1.3×', note: '🔥 Piek', color: '#10b981' },
  { month: 'Mei', mult: '1.3×', note: '🔥 Piek', color: '#10b981' },
  { month: 'Jun', mult: '1.0×', note: 'Stabiel', color: '#8896a8' },
  { month: 'Jul', mult: '0.9×', note: 'Dip', color: '#374151' },
  { month: 'Aug', mult: '0.9×', note: 'Vakantie', color: '#374151' },
  { month: 'Sep', mult: '1.2×', note: '🔥 Piek', color: '#10b981' },
  { month: 'Okt', mult: '1.1×', note: 'Vraag', color: '#f59e0b' },
  { month: 'Nov', mult: '0.8×', note: 'CPMs stijgen', color: '#374151' },
  { month: 'Dec', mult: '0.6×', note: 'Alleen retarg', color: '#374151' },
]

const ROADMAP = [
  { week: 'Week 1', title: 'Direct', items: ['Fix Events Manager custom event fout', 'Pauzeer "AD 1 – Copy 2" in DD-C04 (€11.30 CPL)', 'Upload video creative naar AC-C02 en VL-C03', 'Hernoem alle actieve ads met beschrijvende namen'] },
  { week: 'Week 2', title: 'Structuur', items: ['Bouw Lookalike 1% van Lead Form converters', 'Voeg 4e + 5e creative toe aan campagnes met <5 ads', 'Archiveer alle zero-spend campagnes (40+)', 'Exclusie: sluit bestaande converters uit van prospecting'] },
  { week: 'Week 3', title: 'Schalen', items: ['Test CBO op VL-C03 (beste CPL, genoeg volume)', 'Overweeg BK-C01 consolideren in DD campagnes', 'A/B test nieuw creatief angle op DD-C04 (huidige daalt)', 'Verhoog budget VL-C03 naar min. €30/dag'] },
  { week: 'Week 4', title: 'Review', items: ['Review kwaliteitsrankings — stop "Below average bottom 35%"', 'Beoordeel frequentie DD-C04 en VL-C03 (naderen 3.0)', 'Plan nieuwe creative batch voor alle actieve verticals', 'Google Search voorbereiden (zoekwoordenonderzoek)'] },
]

function StrategieTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Platform mix */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#8896a8', marginBottom: 14 }}>Aanbevolen platformmix</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
              {['Platform', 'Rol', 'Budget %', 'Doel CPL', 'Max CPL'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 10, fontWeight: 500, color: '#4a5568' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLATFORM_MIX.map((p, i) => (
              <tr key={i} style={{ borderBottom: i < PLATFORM_MIX.length - 1 ? '1px solid #0f0f1a' : 'none' }}>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                    <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{p.platform}</span>
                  </div>
                </td>
                <td style={{ padding: '8px 12px', color: '#4a5568' }}>{p.role}</td>
                <td style={{ padding: '8px 12px', color: p.color, fontWeight: 600 }}>{p.budget}</td>
                <td style={{ padding: '8px 12px', color: '#10b981' }}>{p.cpl}</td>
                <td style={{ padding: '8px 12px', color: '#ef4444' }}>{p.maxCpl}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: '#374151', marginTop: 10 }}>* B2B budget is apart van B2C — strikt gescheiden houden</div>
      </div>

      {/* Seasonality */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#8896a8', marginBottom: 14 }}>Seizoensstrategie (budget multiplier)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6 }}>
          {SEASONS.map(s => (
            <div key={s.month} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 4 }}>{s.month}</div>
              <div style={{
                padding: '6px 4px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: s.color + '20', color: s.color, border: `1px solid ${s.color}40`,
              }}>{s.mult}</div>
              <div style={{ fontSize: 9, color: '#374151', marginTop: 3, lineHeight: 1.2 }}>{s.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#8896a8', marginBottom: 14 }}>30-dagenplan</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {ROADMAP.map((r, i) => (
            <div key={i} style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>{r.week}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 10 }}>{r.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.items.map((item, j) => (
                  <div key={j} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#374151', marginTop: 5, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#8896a8', lineHeight: 1.4 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 70/20/10 framework */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#8896a8', marginBottom: 14 }}>70/20/10 Budgetframework (per partner)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { pct: '70%', label: 'Proven', desc: 'Bewezen ROI behouden', where: 'Meta B2C (actief + winstgevend)', color: '#10b981' },
            { pct: '20%', label: 'Scaling', desc: 'Groei versnellen', where: 'Google Search (opbouwen)', color: '#6366f1' },
            { pct: '10%', label: 'Testing', desc: 'Nieuwe kanalen valideren', where: 'LinkedIn B2B of Google Display', color: '#f59e0b' },
          ].map(t => (
            <div key={t.pct} style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: t.color }}>{t.pct}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', margin: '4px 0 2px' }}>{t.label}</div>
              <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 8 }}>{t.desc}</div>
              <div style={{ fontSize: 11, color: '#374151', borderTop: '1px solid #1a1a2e', paddingTop: 8 }}>{t.where}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
