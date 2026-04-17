'use client'

import { useState, useEffect, useCallback } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { dbGet, dbSet, dbSubscribe } from '../../lib/db'

/* ════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════ */
type Division = 'daken' | 'dakkapel' | 'bouw' | 'extras'

const DIVISIONS: { id: Division; label: string; color: string }[] = [
  { id: 'daken',    label: 'Daken',    color: '#525252' },
  { id: 'dakkapel', label: 'Dakkapel', color: '#525252' },
  { id: 'bouw',     label: 'Bouw',     color: '#525252' },
  { id: 'extras',   label: "Extra's",  color: '#525252' },
]

/** Static company info — never resets */
type Company = {
  id: string
  name: string
  division: Division
  startMonth: string           // "YYYY-MM"
  adBudget: number             // advertentiebudget dat klant bij ons betaalt / maand
  adBudgetPaidDate?: string    // datum waarop advertentiebudget is betaald (YYYY-MM-DD)
  ownRevenueTarget: number     // gewenste eigen commissie / maand
  clientRevenueTarget: number  // gewenste gegenereerde omzet voor klant / maand
  leadsTarget: number          // contract totaal leads
  notes?: string
}

/** Per-month actuals — resets each month */
type MonthEntry = {
  monthlyFee: number           // gerealiseerde commissie deze maand
  revenueGenerated: number     // gerealiseerde omzet voor klant deze maand
  leadsReceived: number        // leads geleverd deze maand
}

type MonthlyStore = Record<string, MonthEntry> // key: `${companyId}_${YYYY-MM}`

/** Cost entry — either recurring (monthly) or one-off */
type CostEntry = {
  id: string
  description: string
  amount: number
  type: 'recurring' | 'oneoff'
  date: string      // YYYY-MM-DD for one-off, YYYY-MM for recurring (billing month)
  category: string  // bijv. "Tools", "Advertentie", "Personeel", "Overig"
}

const COST_CATEGORIES = ['Tools', 'Advertentie', 'Personeel', 'Kantoor', 'Overig']

/* ── Cashflow ── */
type CashflowCategory = 'commissie' | 'ad budget' | 'deal' | 'overig'

type CashflowEntry = {
  id: string
  description: string
  clientName?: string
  amount: number
  date: string          // YYYY-MM-DD — eerste (of eenmalige) betaaldatum
  category: CashflowCategory
  recurring: boolean    // maandelijks terugkerend
  notes?: string
  createdAt: string
}

const CASHFLOW_CATS: { id: CashflowCategory; label: string; color: string; bg: string; border: string }[] = [
  { id: 'commissie',  label: 'Commissie',  color: '#0a0a0a', bg: '#f5f5f5', border: '#e5e5e5' },
  { id: 'ad budget',  label: 'Ad budget',  color: '#0a0a0a', bg: '#f5f5f5', border: '#e5e5e5' },
  { id: 'deal',       label: 'Deal',       color: '#0a0a0a', bg: '#f5f5f5', border: '#e5e5e5' },
  { id: 'overig',     label: 'Overig',     color: '#0a0a0a', bg: '#f5f5f5', border: '#e5e5e5' },
]

/** Losse inkomstenpost — buiten vaste klantcommissies om */
type IncomeEntry = {
  id: string
  description: string
  amount: number
  date: string      // YYYY-MM-DD
  category: string
}

const INCOME_CATEGORIES = ['Consultancy', 'Eenmalige klus', 'Doorverwijzing', 'Overig']

const COMPANY_EMPTY: Omit<Company, 'id'> = {
  name: '', division: 'daken',
  startMonth: new Date().toISOString().slice(0, 7),
  adBudget: 0, adBudgetPaidDate: '', ownRevenueTarget: 0, clientRevenueTarget: 0, leadsTarget: 0, notes: '',
}
const ENTRY_EMPTY: MonthEntry = { monthlyFee: 0, revenueGenerated: 0, leadsReceived: 0 }

/* ════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════ */
function eur(n: number, dec = 0) {
  return '€' + n.toLocaleString('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function monthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  const names = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
  return `${names[parseInt(m) - 1]} '${y.slice(2)}`
}
function addMonths(yyyymm: string, n: number) {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function thisMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function lastSixMonths(from: string): string[] {
  return Array.from({ length: 6 }, (_, i) => addMonths(from, i - 5))
}
function entryKey(companyId: string, month: string) {
  return `${companyId}_${month}`
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
const CARD = { background: '#ffffff', borderRadius: 8, padding: '20px', border: '1px solid #e5e5e5' } as const
const INPUT = { width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, background: '#fafafa', border: '1px solid #e5e5e5', color: '#0a0a0a', outline: 'none' } as const
const LABEL = { fontSize: 11, fontWeight: 600 as const, color: '#a3a3a3', marginBottom: 5, display: 'block' as const, letterSpacing: '0.5px', textTransform: 'uppercase' as const }

export default function FinanceTab() {
  const [sub, setSub] = useState<'overzicht' | 'kosten' | 'pipeline'>('overzicht')
  const [cashflow, setCashflow] = useState<CashflowEntry[]>([])
  const [cashflowModal, setCashflowModal] = useState<Partial<CashflowEntry> | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [monthly, setMonthly] = useState<MonthlyStore>({})
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [costModal, setCostModal] = useState<Partial<CostEntry> | null>(null)
  const [incomes, setIncomes] = useState<IncomeEntry[]>([])
  const [incomeModal, setIncomeModal] = useState<Partial<IncomeEntry> | null>(null)
  const [activeMonth, setActiveMonth] = useState(thisMonth())
  const [activeDiv, setActiveDiv] = useState<Division | 'all'>('all')
  const [companyModal, setCompanyModal] = useState<{ mode: 'add' | 'edit'; data: Omit<Company, 'id'> & { id?: string } } | null>(null)
  const [entryModal, setEntryModal] = useState<{ company: Company; draft: MonthEntry } | null>(null)
  const [detail, setDetail] = useState<Company | null>(null)
  const [topTargets, setTopTargets] = useState({ ownTarget: 0, clientTarget: 0 })

  /* ── Load + migrate ── */
  useEffect(() => {
    async function load() {
      try {
        const t = await dbGet('bouwcheck_finance_targets')
        if (t) setTopTargets(t)

        const m = await dbGet('bouwcheck_monthly_v1')
        if (m) setMonthly(m)
        const co = await dbGet('bouwcheck_costs_v1')
        if (co) setCosts(co)
        const inc = await dbGet('bouwcheck_incomes_v1')
        if (inc) setIncomes(inc)
        const cf = await dbGet('bouwcheck_cashflow_v1')
        if (cf) setCashflow(cf)

        const v3raw = await dbGet('bouwcheck_companies_v3')
        if (v3raw) {
          setCompanies(v3raw)
          return
        }

        // ── Migrate from v2 ──
        const v2raw = await dbGet('bouwcheck_companies_v2')
        if (v2raw) {
          const v2: any[] = v2raw
          const now = thisMonth()
          const migratedCompanies: Company[] = v2.map((c: any) => ({
            id: c.id,
            name: c.name,
            division: c.division ?? 'bouw',
            startMonth: c.startMonth ?? now,
            adBudget: 0,
            ownRevenueTarget: c.ownRevenueTarget ?? 0,
            clientRevenueTarget: c.clientRevenueTarget ?? 0,
            leadsTarget: c.leadsTarget ?? 0,
            notes: c.notes ?? '',
          }))
          const migratedMonthly: MonthlyStore = {}
          v2.forEach((c: any) => {
            const key = entryKey(c.id, now)
            migratedMonthly[key] = {
              monthlyFee: c.monthlyFee ?? 0,
              revenueGenerated: c.revenueGenerated ?? 0,
              leadsReceived: c.leadsReceived ?? 0,
            }
          })
          dbSet('bouwcheck_companies_v3', migratedCompanies)
          dbSet('bouwcheck_monthly_v1', migratedMonthly)
          setCompanies(migratedCompanies)
          setMonthly(migratedMonthly)
          return
        }

        // ── Geen data: vul client map bedrijven in als startpunt ──
        const defaults: Company[] = [
          { id: 'cm1', name: 'Bouwcombinatie Amsterdam', division: 'bouw',  startMonth: thisMonth(), adBudget: 0, ownRevenueTarget: 0, clientRevenueTarget: 0, leadsTarget: 0, notes: '' },
          { id: 'cm2', name: 'Hollands Prefab',          division: 'bouw',  startMonth: thisMonth(), adBudget: 0, ownRevenueTarget: 0, clientRevenueTarget: 0, leadsTarget: 0, notes: '' },
          { id: 'cm3', name: 'TBouw',                    division: 'bouw',  startMonth: thisMonth(), adBudget: 0, ownRevenueTarget: 0, clientRevenueTarget: 0, leadsTarget: 0, notes: '' },
          { id: 'cm4', name: 'Miza Group',               division: 'bouw',  startMonth: thisMonth(), adBudget: 0, ownRevenueTarget: 0, clientRevenueTarget: 0, leadsTarget: 0, notes: '' },
          { id: 'cm5', name: 'Prefab op maat',           division: 'bouw',  startMonth: thisMonth(), adBudget: 0, ownRevenueTarget: 0, clientRevenueTarget: 0, leadsTarget: 0, notes: '' },
          { id: 'cm6', name: 'Flair',                    division: 'daken', startMonth: thisMonth(), adBudget: 0, ownRevenueTarget: 0, clientRevenueTarget: 0, leadsTarget: 0, notes: '' },
        ]
        dbSet('bouwcheck_companies_v3', defaults)
        setCompanies(defaults)
      } catch {}
    }
    load()

    // ── Realtime sync ──
    const channel = dbSubscribe(
      ['bouwcheck_companies_v3', 'bouwcheck_monthly_v1', 'bouwcheck_finance_targets', 'bouwcheck_costs_v1', 'bouwcheck_incomes_v1', 'bouwcheck_cashflow_v1'],
      (key, value) => {
        if (key === 'bouwcheck_companies_v3') setCompanies(value)
        if (key === 'bouwcheck_monthly_v1') setMonthly(value)
        if (key === 'bouwcheck_finance_targets') setTopTargets(value)
        if (key === 'bouwcheck_costs_v1') setCosts(value)
        if (key === 'bouwcheck_incomes_v1') setIncomes(value)
        if (key === 'bouwcheck_cashflow_v1') setCashflow(value)
      }
    )
    return () => { channel.unsubscribe() }
  }, [])

  /* ── Persist ── */
  const saveCompanies = useCallback((next: Company[]) => {
    setCompanies(next)
    dbSet('bouwcheck_companies_v3', next)
  }, [])
  const saveMonthly = useCallback((next: MonthlyStore) => {
    setMonthly(next)
    dbSet('bouwcheck_monthly_v1', next)
  }, [])
  const saveTopTargets = (next: typeof topTargets) => {
    setTopTargets(next)
    dbSet('bouwcheck_finance_targets', next)
  }
  const saveCosts = useCallback((next: CostEntry[]) => {
    setCosts(next)
    dbSet('bouwcheck_costs_v1', next)
  }, [])
  const saveIncomes = useCallback((next: IncomeEntry[]) => {
    setIncomes(next)
    dbSet('bouwcheck_incomes_v1', next)
  }, [])
  const saveCashflow = useCallback((next: CashflowEntry[]) => {
    setCashflow(next)
    dbSet('bouwcheck_cashflow_v1', next)
  }, [])

  const submitIncome = () => {
    if (!incomeModal?.description || !incomeModal.amount) return
    const entry: IncomeEntry = {
      id: incomeModal.id ?? Date.now().toString(),
      description: incomeModal.description,
      amount: incomeModal.amount,
      date: incomeModal.date ?? new Date().toISOString().slice(0, 10),
      category: incomeModal.category ?? 'Overig',
    }
    if (incomeModal.id) {
      saveIncomes(incomes.map(i => i.id === incomeModal.id ? entry : i))
    } else {
      saveIncomes([...incomes, entry])
    }
    setIncomeModal(null)
  }

  const incomesForMonth = (month: string) =>
    incomes.filter(i => i.date.slice(0, 7) === month)
  const totalExtraIncomeForMonth = (month: string) =>
    incomesForMonth(month).reduce((s, i) => s + i.amount, 0)

  const submitCost = () => {
    if (!costModal?.description || !costModal.amount) return
    const entry: CostEntry = {
      id: costModal.id ?? Date.now().toString(),
      description: costModal.description,
      amount: costModal.amount,
      type: costModal.type ?? 'oneoff',
      date: costModal.date ?? activeMonth,
      category: costModal.category ?? 'Overig',
    }
    if (costModal.id) {
      saveCosts(costs.map(c => c.id === costModal.id ? entry : c))
    } else {
      saveCosts([...costs, entry])
    }
    setCostModal(null)
  }

  /** Returns costs that apply to a given YYYY-MM */
  const costsForMonth = (month: string): CostEntry[] => {
    return costs.filter(c => {
      if (c.type === 'recurring') return c.date.slice(0, 7) <= month
      return c.date.slice(0, 7) === month
    })
  }
  const totalCostsForMonth = (month: string) =>
    costsForMonth(month).reduce((s, c) => s + c.amount, 0)

  /* ── Entry helpers ── */
  const getEntry = (companyId: string, month: string): MonthEntry =>
    monthly[entryKey(companyId, month)] ?? ENTRY_EMPTY

  const submitEntry = () => {
    if (!entryModal) return
    const key = entryKey(entryModal.company.id, activeMonth)
    saveMonthly({ ...monthly, [key]: entryModal.draft })
    setEntryModal(null)
  }

  /* ── Company modal submit ── */
  const submitCompany = () => {
    if (!companyModal) return
    if (companyModal.mode === 'add') {
      saveCompanies([...companies, { ...companyModal.data, id: Date.now().toString() } as Company])
    } else {
      saveCompanies(companies.map(c => c.id === companyModal.data.id ? companyModal.data as Company : c))
    }
    setCompanyModal(null)
  }
  const removeCompany = (id: string) => {
    if (!window.confirm('Bedrijf verwijderen?')) return
    saveCompanies(companies.filter(c => c.id !== id))
  }

  /* ── Aggregates for active month ── */
  const activeCompanies = companies.filter(c => c.startMonth <= activeMonth)
  const visible = activeDiv === 'all' ? activeCompanies : activeCompanies.filter(c => c.division === activeDiv)

  const totalOwn = activeCompanies.reduce((s, c) => s + getEntry(c.id, activeMonth).monthlyFee, 0)
  const totalClient = activeCompanies.reduce((s, c) => s + getEntry(c.id, activeMonth).revenueGenerated, 0)
  const totalAdBudget = activeCompanies.reduce((s, c) => s + c.adBudget, 0)
  const sumOwnTarget = activeCompanies.reduce((s, c) => s + (c.ownRevenueTarget || 0), 0)
  const sumClientTarget = activeCompanies.reduce((s, c) => s + (c.clientRevenueTarget || 0), 0)
  const effectiveOwnTarget = sumOwnTarget > 0 ? sumOwnTarget : topTargets.ownTarget
  const effectiveClientTarget = sumClientTarget > 0 ? sumClientTarget : topTargets.clientTarget
  const nearFull = companies.filter(c => {
    if (c.leadsTarget <= 0) return false
    const total = lastSixMonths(addMonths(thisMonth(), -5))
      .reduce((s, m) => s + getEntry(c.id, m).leadsReceived, 0)
    return total / c.leadsTarget >= 0.8
  })

  /* ── Ad budget payment reminders (companies without lead target) ── */
  const adBudgetReminders = companies.filter(c => {
    if (c.leadsTarget > 0) return false       // alleen bedrijven zonder lead target
    if (!c.adBudgetPaidDate || !c.adBudget) return false
    const lastPaid = new Date(c.adBudgetPaidDate)
    const nextDue = new Date(lastPaid)
    nextDue.setMonth(nextDue.getMonth() + 1)
    const daysUntil = Math.ceil((nextDue.getTime() - Date.now()) / 86400000)
    return daysUntil <= 7 && daysUntil >= -3   // binnen 7 dagen of max 3 dagen te laat
  }).map(c => {
    const lastPaid = new Date(c.adBudgetPaidDate!)
    const nextDue = new Date(lastPaid)
    nextDue.setMonth(nextDue.getMonth() + 1)
    const daysUntil = Math.ceil((nextDue.getTime() - Date.now()) / 86400000)
    return { company: c, nextDue, daysUntil }
  })

  /* ── Chart data: per bedrijf voor actieve maand ── */
  const chartData = activeCompanies.map(c => {
    const e = getEntry(c.id, activeMonth)
    const div = DIVISIONS.find(d => d.id === c.division)!
    return {
      name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name,
      fullName: c.name,
      division: c.division,
      color: div.color,
      commissie: e.monthlyFee,
      commissieTarget: c.ownRevenueTarget,
      gegenereerd: e.revenueGenerated,
      gegGenTarget: c.clientRevenueTarget,
    }
  })

  const isPast = activeMonth < thisMonth()
  const isPresent = activeMonth === thisMonth()

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0a', margin: 0 }}>Finance</h1>
          <p style={{ fontSize: 13, color: '#525252', marginTop: 4 }}>B2B commissie & gegenereerde omzet per divisie</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Sub-tab */}
          {(['overzicht', 'kosten', 'pipeline'] as const).map(t => (
            <button key={t} onClick={() => setSub(t)}
              style={{
                padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: sub === t ? 500 : 400, cursor: 'pointer',
                background: sub === t ? '#ffffff' : 'transparent',
                border: sub === t ? '1px solid #d4d4d4' : '1px solid transparent',
                color: sub === t ? '#0a0a0a' : '#525252',
              }}>
              {t === 'overzicht' ? 'Overzicht' : t === 'kosten' ? 'Kosten & Winst' : 'Cashflow'}
            </button>
          ))}
          {/* Month navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#ffffff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e5e5' }}>
            <button onClick={() => setActiveMonth(m => addMonths(m, -1))}
              style={{ padding: '7px 13px', background: 'none', border: 'none', color: '#525252', cursor: 'pointer', fontSize: 14 }}>‹</button>
            <div style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#0a0a0a', borderLeft: '1px solid #e5e5e5', borderRight: '1px solid #e5e5e5', minWidth: 100, textAlign: 'center' }}>
              {monthLabel(activeMonth)}
              {isPresent && <span style={{ fontSize: 10, color: '#a3a3a3', marginLeft: 6 }}>huidig</span>}
            </div>
            <button onClick={() => setActiveMonth(m => addMonths(m, 1))}
              style={{ padding: '7px 13px', background: 'none', border: 'none', color: '#525252', cursor: 'pointer', fontSize: 14 }}>›</button>
          </div>
          {sub === 'overzicht' && (
            <button
              onClick={() => setCompanyModal({ mode: 'add', data: { ...COMPANY_EMPTY } })}
              style={{ padding: '9px 16px', background: '#171717', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Bedrijf
            </button>
          )}
          {sub === 'pipeline' && (
            <button
              onClick={() => setCashflowModal({ category: 'commissie', recurring: false, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() })}
              style={{ padding: '9px 16px', background: '#171717', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Betaling
            </button>
          )}
          {sub === 'kosten' && (<>
            <button
              onClick={() => setIncomeModal({ category: 'Overig', date: new Date().toISOString().slice(0, 10) })}
              style={{ padding: '9px 16px', background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 6, color: '#0a0a0a', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Inkomstenpost
            </button>
            <button
              onClick={() => setCostModal({ type: 'oneoff', category: 'Overig', date: new Date().toISOString().slice(0, 10) })}
              style={{ padding: '9px 16px', background: '#171717', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Kostenpost
            </button>
          </>)}
        </div>
      </div>

      {sub === 'overzicht' && <>
      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <TargetKpiCard
          label="Eigen commissie / maand"
          actual={totalOwn} target={effectiveOwnTarget} color="#171717"
          sub={sumOwnTarget > 0 ? `${activeCompanies.filter(c => c.ownRevenueTarget > 0).length} bedrijfstargets` : `${activeCompanies.length} actieve klanten`}
          autoTarget={sumOwnTarget > 0}
          onTargetChange={v => saveTopTargets({ ...topTargets, ownTarget: v })}
        />
        <TargetKpiCard
          label="Gegenereerd voor klanten"
          actual={totalClient} target={effectiveClientTarget} color="#171717"
          sub={sumClientTarget > 0 ? `${activeCompanies.filter(c => c.clientRevenueTarget > 0).length} bedrijfstargets` : 'totale waardecreatie'}
          autoTarget={sumClientTarget > 0}
          onTargetChange={v => saveTopTargets({ ...topTargets, clientTarget: v })}
        />
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a3a3a3', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Advertentiebudget klanten</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#0a0a0a', fontVariantNumeric: 'tabular-nums' }}>{eur(totalAdBudget)}</div>
          <div style={{ fontSize: 12, color: '#a3a3a3', marginTop: 4 }}>totaal advertentiebudget</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a3a3a3', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Bijna vol contract</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: nearFull.length > 0 ? '#ef4444' : '#0a0a0a', fontVariantNumeric: 'tabular-nums' }}>{nearFull.length}</div>
          <div style={{ fontSize: 12, color: nearFull.length > 0 ? '#ef4444' : '#a3a3a3', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nearFull.length > 0 ? nearFull.map(c => c.name).join(', ') : 'Geen'}
          </div>
        </div>
      </div>

      {/* ── Chart ── */}
      {activeCompanies.length > 0 && (
        <div style={{ ...CARD, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a3a3a3', marginBottom: 14, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
            Commissie per bedrijf (bars, kleur = divisie) + gegenereerde omzet voor klant (lijn) — {monthLabel(activeMonth)}
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: 'none', borderRadius: 8, color: '#111827', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  const div = DIVISIONS.find(x => x.id === d.division)!
                  return (
                    <div style={{ background: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      <div style={{ fontWeight: 600, color: '#0a0a0a', marginBottom: 8 }}>{d.fullName}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: '#525252' }}>Commissie:<span style={{ color: '#0a0a0a', fontWeight: 600 }}>{eur(d.commissie)}</span>
                          {d.commissieTarget > 0 && <span style={{ color: '#525252' }}> / {eur(d.commissieTarget)}</span>}
                        </span>
                        <span style={{ color: '#525252' }}>Gegenereerd:<span style={{ color: '#0a0a0a', fontWeight: 600 }}>{eur(d.gegenereerd)}</span>
                          {d.gegGenTarget > 0 && <span style={{ color: '#525252' }}> / {eur(d.gegGenTarget)}</span>}
                        </span>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="commissie" maxBarSize={40} radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
              <Line dataKey="gegenereerd" type="monotone" stroke="#6366f1" strokeWidth={2}
                dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6b7280', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
            {DIVISIONS.map(d => (
              <span key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: 'inline-block' }} />
                {d.label}
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 2, background: '#6366f1', display: 'inline-block', borderRadius: 1 }} />
              Gegenereerd voor klant
            </span>
          </div>
        </div>
      )}

      {/* ── Division filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ id: 'all' as const, label: 'Alle', color: '#374151' }, ...DIVISIONS].map(d => {
          const count = d.id === 'all' ? activeCompanies.length : activeCompanies.filter(c => c.division === d.id).length
          return (
            <button key={d.id} onClick={() => setActiveDiv(d.id as any)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: activeDiv === d.id ? d.color + '18' : '#ffffff',
                border: `1px solid ${activeDiv === d.id ? d.color : '#e5e7eb'}`,
                color: activeDiv === d.id ? d.color : '#374151',
              }}>
              {d.label} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          )
        })}
      </div>

      {/* ── Company grid ── */}
      {visible.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>
          {companies.length === 0 ? 'Nog geen bedrijven — klik "+ Bedrijf" om te starten.' : 'Geen bedrijven in deze divisie.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {visible.map(c => (
            <CompanyCard
              key={c.id}
              company={c}
              entry={getEntry(c.id, activeMonth)}
              month={activeMonth}
              monthly={monthly}
              onEditEntry={() => setEntryModal({ company: c, draft: { ...getEntry(c.id, activeMonth) } })}
              onClickDetail={() => setDetail(c)}
              onEditCompany={() => setCompanyModal({ mode: 'edit', data: { ...c } })}
            />
          ))}
        </div>
      )}

      {/* ── Company add/edit modal ── */}
      {companyModal && (
        <Modal onClose={() => setCompanyModal(null)}>
          <ModalHeader
            title={companyModal.mode === 'add' ? 'Bedrijf toevoegen' : 'Bedrijf bewerken'}
            onClose={() => setCompanyModal(null)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={LABEL}>Bedrijfsnaam</label>
              <input style={INPUT} value={companyModal.data.name}
                onChange={e => setCompanyModal(m => m && { ...m, data: { ...m.data, name: e.target.value } })} />
            </div>
            <div>
              <label style={LABEL}>Divisie</label>
              <select style={INPUT} value={companyModal.data.division}
                onChange={e => setCompanyModal(m => m && { ...m, data: { ...m.data, division: e.target.value as Division } })}>
                {DIVISIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Start maand</label>
              <input type="month" style={INPUT} value={companyModal.data.startMonth}
                onChange={e => setCompanyModal(m => m && { ...m, data: { ...m.data, startMonth: e.target.value } })} />
            </div>
            <div>
              <label style={LABEL}>Advertentiebudget (€)</label>
              <input type="number" style={INPUT} value={companyModal.data.adBudget || ''}
                placeholder="0"
                onChange={e => setCompanyModal(m => m && { ...m, data: { ...m.data, adBudget: +e.target.value } })} />
            </div>
            <div>
              <label style={LABEL}>Advertentiebudget betaald op</label>
              <input type="date" style={INPUT} value={companyModal.data.adBudgetPaidDate ?? ''}
                onChange={e => setCompanyModal(m => m && { ...m, data: { ...m.data, adBudgetPaidDate: e.target.value } })} />
            </div>
            <div>
              <label style={LABEL}>Commissie target / maand (€) <span style={{ color: '#9ca3af', fontWeight: 400 }}>→ omzet target automatisch (×20)</span></label>
              <input type="number" style={INPUT} value={companyModal.data.ownRevenueTarget || ''}
                placeholder="0"
                onChange={e => {
                  const v = +e.target.value
                  setCompanyModal(m => m && { ...m, data: { ...m.data, ownRevenueTarget: v, clientRevenueTarget: Math.round(v * 20) } })
                }} />
            </div>
            <div>
              <label style={LABEL}>Omzet target klant / maand (€) <span style={{ color: '#9ca3af', fontWeight: 400 }}>→ commissie target automatisch (×5%)</span></label>
              <input type="number" style={INPUT} value={companyModal.data.clientRevenueTarget || ''}
                placeholder="0"
                onChange={e => {
                  const v = +e.target.value
                  setCompanyModal(m => m && { ...m, data: { ...m.data, clientRevenueTarget: v, ownRevenueTarget: Math.round(v * 0.05) } })
                }} />
            </div>
            <div>
              <label style={LABEL}>Leads target (contract totaal)</label>
              <input type="number" style={INPUT} value={companyModal.data.leadsTarget || ''}
                placeholder="0"
                onChange={e => setCompanyModal(m => m && { ...m, data: { ...m.data, leadsTarget: +e.target.value } })} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={LABEL}>Notities</label>
              <textarea style={{ ...INPUT, height: 60, resize: 'vertical' }}
                value={companyModal.data.notes || ''}
                onChange={e => setCompanyModal(m => m && { ...m, data: { ...m.data, notes: e.target.value } })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            {companyModal.mode === 'edit' && (
              <button onClick={() => { removeCompany(companyModal.data.id!); setCompanyModal(null) }}
                style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #ef444440', borderRadius: 8, color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>
                Verwijderen
              </button>
            )}
            <button onClick={() => setCompanyModal(null)}
              style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, cursor: 'pointer' }}>
              Annuleren
            </button>
            <button onClick={submitCompany} disabled={!companyModal.data.name.trim()}
              style={{ padding: '9px 20px', background: companyModal.data.name.trim() ? '#0f172a' : '#e5e7eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: companyModal.data.name.trim() ? 'pointer' : 'default' }}>
              {companyModal.mode === 'add' ? 'Toevoegen' : 'Opslaan'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Monthly entry modal ── */}
      {entryModal && (
        <Modal onClose={() => setEntryModal(null)}>
          <ModalHeader title={`${entryModal.company.name} — ${monthLabel(activeMonth)}`} onClose={() => setEntryModal(null)} />
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>Vul de gerealiseerde cijfers in voor deze maand</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={LABEL}>Gerealiseerde commissie (€) <span style={{ color: '#9ca3af', fontWeight: 400 }}>→ omzet wordt automatisch berekend (×20)</span></label>
              <input type="number" style={INPUT} value={entryModal.draft.monthlyFee || ''}
                placeholder="0"
                onChange={e => {
                  const fee = +e.target.value
                  setEntryModal(m => m && { ...m, draft: { ...m.draft, monthlyFee: fee, revenueGenerated: Math.round(fee * 20) } })
                }} />
            </div>
            <div>
              <label style={LABEL}>Gegenereerd voor klant (€) <span style={{ color: '#9ca3af', fontWeight: 400 }}>→ commissie wordt automatisch berekend (×5%)</span></label>
              <input type="number" style={INPUT} value={entryModal.draft.revenueGenerated || ''}
                placeholder="0"
                onChange={e => {
                  const rev = +e.target.value
                  setEntryModal(m => m && { ...m, draft: { ...m.draft, revenueGenerated: rev, monthlyFee: Math.round(rev * 0.05) } })
                }} />
            </div>
            <div>
              <label style={LABEL}>Leads geleverd</label>
              <input type="number" style={INPUT} value={entryModal.draft.leadsReceived || ''}
                placeholder="0"
                onChange={e => setEntryModal(m => m && { ...m, draft: { ...m.draft, leadsReceived: +e.target.value } })} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <button onClick={() => setEntryModal(null)}
              style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, cursor: 'pointer' }}>
              Annuleren
            </button>
            <button onClick={submitEntry}
              style={{ padding: '9px 20px', background: '#171717', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Opslaan
            </button>
          </div>
        </Modal>
      )}

      {/* ── Detail modal ── */}
      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <DetailView
            company={detail}
            monthly={monthly}
            onEdit={() => { setDetail(null); setCompanyModal({ mode: 'edit', data: { ...detail } }) }}
            onClose={() => setDetail(null)}
          />
        </Modal>
      )}
      </>}

      {sub === 'kosten' && (
        <KostenTab
          costs={costs}
          incomes={incomes}
          activeMonth={activeMonth}
          totalCommission={totalOwn}
          costsForMonth={costsForMonth}
          totalCostsForMonth={totalCostsForMonth}
          incomesForMonth={incomesForMonth}
          totalExtraIncomeForMonth={totalExtraIncomeForMonth}
          onEditCost={c => setCostModal({ ...c })}
          onDeleteCost={id => saveCosts(costs.filter(c => c.id !== id))}
          onEditIncome={i => setIncomeModal({ ...i })}
          onDeleteIncome={id => saveIncomes(incomes.filter(i => i.id !== id))}
        />
      )}

      {sub === 'pipeline' && (
        <CashflowSub
          entries={cashflow}
          onEdit={e => setCashflowModal({ ...e })}
          onDelete={id => saveCashflow(cashflow.filter(e => e.id !== id))}
        />
      )}

      {/* ── Cashflow modal ── */}
      {cashflowModal !== null && (
        <Modal onClose={() => setCashflowModal(null)}>
          <ModalHeader
            title={cashflowModal.id ? 'Betaling bewerken' : 'Betaling toevoegen'}
            onClose={() => setCashflowModal(null)}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL}>Categorie</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CASHFLOW_CATS.map(c => (
                  <button key={c.id} onClick={() => setCashflowModal(m => m && { ...m, category: c.id })}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: cashflowModal.category === c.id ? c.bg : '#f9fafb', border: `1px solid ${cashflowModal.category === c.id ? c.color : '#e5e7eb'}`, color: cashflowModal.category === c.id ? c.color : '#374151' }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL}>Omschrijving</label>
                <input style={INPUT} placeholder="bijv. commissie aanbouw, Flair ad budget…"
                  value={cashflowModal.description ?? ''}
                  onChange={e => setCashflowModal(m => m && { ...m, description: e.target.value })} />
              </div>
              <div>
                <label style={LABEL}>Klantnaam (optioneel)</label>
                <input style={INPUT} placeholder="bijv. TBouw, Flair…"
                  value={cashflowModal.clientName ?? ''}
                  onChange={e => setCashflowModal(m => m && { ...m, clientName: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL}>Bedrag (€)</label>
                <input style={INPUT} type="number" placeholder="0"
                  value={cashflowModal.amount ?? ''}
                  onChange={e => setCashflowModal(m => m && { ...m, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={LABEL}>Datum</label>
                <input style={INPUT} type="date"
                  value={cashflowModal.date ?? ''}
                  onChange={e => setCashflowModal(m => m && { ...m, date: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={LABEL}>Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([{ v: false, label: 'Eenmalig' }, { v: true, label: 'Maandelijks terugkerend' }]).map(opt => (
                  <button key={String(opt.v)} onClick={() => setCashflowModal(m => m && { ...m, recurring: opt.v })}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: cashflowModal.recurring === opt.v ? '#eef2ff' : '#f9fafb', border: `1px solid ${cashflowModal.recurring === opt.v ? '#6366f1' : '#e5e7eb'}`, color: cashflowModal.recurring === opt.v ? '#4f46e5' : '#374151', fontWeight: cashflowModal.recurring === opt.v ? 600 : 400 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={LABEL}>Notities</label>
              <textarea style={{ ...INPUT, height: 56, resize: 'vertical' }}
                value={cashflowModal.notes ?? ''}
                onChange={e => setCashflowModal(m => m && { ...m, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              {cashflowModal.id && (
                <button onClick={() => { if (confirm('Verwijderen?')) { saveCashflow(cashflow.filter(e => e.id !== cashflowModal.id)); setCashflowModal(null) } }}
                  style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #fca5a5', borderRadius: 8, color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>
                  Verwijderen
                </button>
              )}
              <button onClick={() => setCashflowModal(null)}
                style={{ padding: '9px 20px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, cursor: 'pointer' }}>
                Annuleren
              </button>
              <button
                disabled={!cashflowModal.description?.trim() || !cashflowModal.amount || !cashflowModal.date}
                onClick={() => {
                  const entry: CashflowEntry = {
                    id: cashflowModal.id ?? Date.now().toString(),
                    description: cashflowModal.description!,
                    clientName: cashflowModal.clientName,
                    amount: cashflowModal.amount ?? 0,
                    date: cashflowModal.date!,
                    category: cashflowModal.category ?? 'commissie',
                    recurring: cashflowModal.recurring ?? false,
                    notes: cashflowModal.notes,
                    createdAt: cashflowModal.createdAt ?? new Date().toISOString(),
                  }
                  if (cashflowModal.id) {
                    saveCashflow(cashflow.map(e => e.id === cashflowModal.id ? entry : e))
                  } else {
                    saveCashflow([...cashflow, entry])
                  }
                  setCashflowModal(null)
                }}
                style={{ padding: '9px 20px', background: cashflowModal.description?.trim() && cashflowModal.amount && cashflowModal.date ? '#0f172a' : '#e5e7eb', border: 'none', borderRadius: 8, color: cashflowModal.description?.trim() && cashflowModal.amount && cashflowModal.date ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {cashflowModal.id ? 'Opslaan' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Income modal ── */}
      {incomeModal !== null && (
        <Modal onClose={() => setIncomeModal(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>
              {incomeModal.id ? 'Inkomstenpost bewerken' : 'Inkomstenpost toevoegen'}
            </h2>
            <button onClick={() => setIncomeModal(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL}>Omschrijving</label>
              <input style={INPUT} placeholder="bijv. adviesgesprek, doorverwijzing, kleine klus…"
                value={incomeModal.description ?? ''}
                onChange={e => setIncomeModal(m => m && { ...m, description: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL}>Bedrag (€)</label>
                <input style={INPUT} type="number" placeholder="0"
                  value={incomeModal.amount ?? ''}
                  onChange={e => setIncomeModal(m => m && { ...m, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={LABEL}>Categorie</label>
                <select style={INPUT} value={incomeModal.category ?? 'Overig'}
                  onChange={e => setIncomeModal(m => m && { ...m, category: e.target.value })}>
                  {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={LABEL}>Datum</label>
              <input style={INPUT} type="date" value={incomeModal.date ?? ''}
                onChange={e => setIncomeModal(m => m && { ...m, date: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => setIncomeModal(null)}
                style={{ padding: '9px 20px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, cursor: 'pointer' }}>
                Annuleren
              </button>
              <button onClick={submitIncome} disabled={!incomeModal.description?.trim() || !incomeModal.amount}
                style={{ padding: '9px 20px', background: incomeModal.description?.trim() && incomeModal.amount ? '#0f172a' : '#e5e7eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Opslaan
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Cost modal ── */}
      {costModal !== null && (
        <Modal onClose={() => setCostModal(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>
              {costModal.id ? 'Kostenpost bewerken' : 'Kostenpost toevoegen'}
            </h2>
            <button onClick={() => setCostModal(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL}>Omschrijving</label>
              <input style={INPUT} placeholder="bijv. Notion, Facebook Ads tool, Philip salaris…"
                value={costModal.description ?? ''}
                onChange={e => setCostModal(m => m && { ...m, description: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL}>Bedrag (€)</label>
                <input style={INPUT} type="number" placeholder="0"
                  value={costModal.amount ?? ''}
                  onChange={e => setCostModal(m => m && { ...m, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={LABEL}>Categorie</label>
                <select style={INPUT} value={costModal.category ?? 'Overig'}
                  onChange={e => setCostModal(m => m && { ...m, category: e.target.value })}>
                  {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={LABEL}>Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['oneoff', 'recurring'] as const).map(t => (
                  <button key={t} onClick={() => setCostModal(m => m && { ...m, type: t })}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                      background: costModal.type === t ? '#eef2ff' : '#f9fafb',
                      border: `1px solid ${costModal.type === t ? '#6366f1' : '#e5e7eb'}`,
                      color: costModal.type === t ? '#4f46e5' : '#374151',
                    }}>
                    {t === 'oneoff' ? 'Eenmalig / onregelmatig' : 'Maandelijks terugkerend'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={LABEL}>{costModal.type === 'recurring' ? 'Ingangsdatum (maand)' : 'Datum'}</label>
              <input style={INPUT} type={costModal.type === 'recurring' ? 'month' : 'date'}
                value={costModal.date ?? ''}
                onChange={e => setCostModal(m => m && { ...m, date: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => setCostModal(null)}
                style={{ padding: '9px 20px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, cursor: 'pointer' }}>
                Annuleren
              </button>
              <button onClick={submitCost} disabled={!costModal.description?.trim() || !costModal.amount}
                style={{ padding: '9px 20px', background: costModal.description?.trim() && costModal.amount ? '#0f172a' : '#e5e7eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Opslaan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   CASHFLOW TAB
════════════════════════════════════════════════════════ */
function CashflowSub({ entries, onEdit, onDelete }: {
  entries: CashflowEntry[]
  onEdit: (e: CashflowEntry) => void
  onDelete: (id: string) => void
}) {
  // Build timeline: current month + next 5 months
  const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth(), i))

  // For each month, collect entries that apply
  function entriesForMonth(month: string): CashflowEntry[] {
    return entries.filter(e => {
      const entryMonth = e.date.slice(0, 7)
      if (e.recurring) return entryMonth <= month  // recurring: apply from start month onwards
      return entryMonth === month                   // one-off: only in its month
    })
  }

  const monthTotals = months.map(m => entriesForMonth(m).reduce((s, e) => s + e.amount, 0))
  const maxTotal = Math.max(...monthTotals, 1)

  // KPI totals
  const recurringMonthly = entries.filter(e => e.recurring).reduce((s, e) => s + e.amount, 0)
  const oneoffTotal = entries.filter(e => !e.recurring).reduce((s, e) => s + e.amount, 0)
  const thisMonthTotal = entriesForMonth(thisMonth()).reduce((s, e) => s + e.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>Terugkerend / maand</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{eur(recurringMonthly)}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{entries.filter(e => e.recurring).length} vaste posten</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>Eenmalig gepland</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{eur(oneoffTotal)}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{entries.filter(e => !e.recurring).length} losse posten</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>Verwacht deze maand</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#4f46e5' }}>{eur(thisMonthTotal)}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{entriesForMonth(thisMonth()).length} posten</div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {months.map((month, idx) => {
          const monthEntries = entriesForMonth(month)
          const total = monthTotals[idx]
          const isNow = month === thisMonth()
          const barPct = Math.round((total / maxTotal) * 100)

          return (
            <div key={month} style={{ ...CARD, boxShadow: isNow ? '0 0 0 2px #c7d2fe, 0 1px 3px rgba(0,0,0,0.06)' : undefined, background: isNow ? '#fafbff' : '#ffffff' }}>
              {/* Month header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: total > 0 ? 14 : 0 }}>
                <div style={{ minWidth: 80 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isNow ? '#4f46e5' : '#0f172a' }}>
                    {monthLabel(month)}
                    {isNow && <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 6, fontWeight: 400 }}>huidig</span>}
                  </div>
                </div>
                {/* Bar */}
                <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: isNow ? '#6366f1' : '#c7d2fe', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: isNow ? '#4f46e5' : '#0f172a', minWidth: 80, textAlign: 'right' }}>
                  {eur(total)}
                </div>
              </div>

              {/* Entries */}
              {monthEntries.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {monthEntries.map(e => {
                    const cat = CASHFLOW_CATS.find(c => c.id === e.category)!
                    return (
                      <div key={e.id}
                        onClick={() => onEdit(e)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, cursor: 'pointer', border: '1px solid transparent', transition: 'border 0.1s' }}
                        onMouseEnter={ev => (ev.currentTarget.style.border = '1px solid #e5e7eb')}
                        onMouseLeave={ev => (ev.currentTarget.style.border = '1px solid transparent')}
                      >
                        {/* Category badge */}
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: cat.bg, border: `1px solid ${cat.border}`, color: cat.color, whiteSpace: 'nowrap' }}>
                          {cat.label}{e.recurring ? ' ↻' : ''}
                        </span>
                        {/* Description */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.description}{e.clientName ? ` — ${e.clientName}` : ''}
                          </div>
                          {e.notes && <div style={{ fontSize: 10, color: '#374151', marginTop: 1 }}>{e.notes}</div>}
                        </div>
                        {/* Date */}
                        <div style={{ fontSize: 10, color: '#374151', whiteSpace: 'nowrap' }}>{e.date}</div>
                        {/* Amount */}
                        <div style={{ fontSize: 13, fontWeight: 700, color: cat.color, minWidth: 60, textAlign: 'right' }}>{eur(e.amount)}</div>
                        {/* Delete */}
                        <button
                          onClick={ev => { ev.stopPropagation(); if (confirm('Verwijderen?')) onDelete(e.id) }}
                          style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {monthEntries.length === 0 && (
                <div style={{ fontSize: 12, color: '#d1d5db', paddingTop: 4 }}>Geen betalingen gepland</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Category legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {CASHFLOW_CATS.map(c => (
          <span key={c.id} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: '#374151' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
            {c.label}
          </span>
        ))}
        <span style={{ fontSize: 11, color: '#374151' }}>↻ = maandelijks terugkerend</span>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   MAAND NOTITIE
════════════════════════════════════════════════════════ */
function MaandNotitie({ activeMonth }: { activeMonth: string }) {
  const [note, setNote] = useState('')
  const key = `bouwcheck_note_${activeMonth}`

  useEffect(() => {
    dbGet(key).then(val => setNote(val ?? ''))
  }, [activeMonth, key])

  const save = (val: string) => {
    setNote(val)
    dbSet(key, val)
  }

  return (
    <div style={CARD}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' as const }}>
        Notities — {monthLabel(activeMonth)}
      </div>
      <textarea
        rows={5}
        placeholder="Vrije notitie over deze maand — wat ging goed, wat niet, wat wil je onthouden…"
        value={note}
        onChange={e => save(e.target.value)}
        style={{ ...INPUT, resize: 'vertical', fontSize: 13, lineHeight: 1.7 }}
      />
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   KOSTEN TAB
════════════════════════════════════════════════════════ */
function KostenTab({ costs, incomes, activeMonth, totalCommission, costsForMonth, totalCostsForMonth, incomesForMonth, totalExtraIncomeForMonth, onEditCost, onDeleteCost, onEditIncome, onDeleteIncome }: {
  costs: CostEntry[]
  incomes: IncomeEntry[]
  activeMonth: string
  totalCommission: number
  costsForMonth: (month: string) => CostEntry[]
  totalCostsForMonth: (month: string) => number
  incomesForMonth: (month: string) => IncomeEntry[]
  totalExtraIncomeForMonth: (month: string) => number
  onEditCost: (c: CostEntry) => void
  onDeleteCost: (id: string) => void
  onEditIncome: (i: IncomeEntry) => void
  onDeleteIncome: (id: string) => void
}) {
  const monthCosts = costsForMonth(activeMonth)
  const totalCosts = totalCostsForMonth(activeMonth)
  const extraIncome = totalExtraIncomeForMonth(activeMonth)
  const monthIncomes = incomesForMonth(activeMonth)
  const totalIncome = totalCommission + extraIncome
  const netProfit = totalIncome - totalCosts
  const recurring = costs.filter(c => c.type === 'recurring')
  const oneoff = costs.filter(c => c.type === 'oneoff' && c.date.slice(0, 7) === activeMonth)

  // Last 6 months profit overview
  const profitHistory = Array.from({ length: 6 }, (_, i) => addMonths(activeMonth, i - 5)).map(m => {
    const income = 0 // we don't have totalOwn per historical month here — pass 0, user sees costs only
    const costTotal = totalCostsForMonth(m)
    return { month: m, label: monthLabel(m), costs: costTotal }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Profit KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>Totale inkomsten</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{eur(totalIncome)}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Commissie {eur(totalCommission)}{extraIncome > 0 ? ` + overig ${eur(extraIncome)}` : ''}
          </div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>Totale kosten</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#ef4444' }}>{eur(totalCosts)}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{monthCosts.length} kostenposten</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>Netto winst</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: netProfit >= 0 ? '#22c55e' : '#ef4444' }}>{eur(netProfit)}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '2px 8px', borderRadius: 20, background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', fontSize: 11, fontWeight: 600, color: netProfit >= 0 ? '#16a34a' : '#dc2626' }}>
            {netProfit >= 0 ? `↑ ${totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0}% marge` : '↓ verlies'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recurring costs */}
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' as const }}>VASTE MAANDELIJKSE LASTEN</div>
          {recurring.length === 0 && <div style={{ fontSize: 12, color: '#6b7280' }}>Geen vaste lasten ingevoerd.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recurring.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f9fafb', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#0f172a' }}>{c.description}</div>
                  <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{c.category} · vanaf {monthLabel(c.date.slice(0, 7))}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{eur(c.amount)}</span>
                  <button onClick={() => onEditCost(c)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>✎</button>
                  <button onClick={() => { if (confirm(`"${c.description}" verwijderen?`)) onDeleteCost(c.id) }} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 13 }}>✕</button>
                </div>
              </div>
            ))}
            {recurring.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Totaal: <strong style={{ color: '#dc2626' }}>{eur(recurring.reduce((s, c) => s + c.amount, 0))}/maand</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* One-off costs this month */}
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' as const }}>EENMALIG / ONREGELMATIG — {monthLabel(activeMonth)}</div>
          {oneoff.length === 0 && <div style={{ fontSize: 12, color: '#6b7280' }}>Geen losse kostenposten deze maand.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {oneoff.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f9fafb', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#0f172a' }}>{c.description}</div>
                  <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{c.category} · {c.date}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{eur(c.amount)}</span>
                  <button onClick={() => onEditCost(c)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>✎</button>
                  <button onClick={() => { if (confirm(`"${c.description}" verwijderen?`)) onDeleteCost(c.id) }} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 13 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Extra income this month */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' as const }}>LOSSE INKOMSTEN — {monthLabel(activeMonth)}</div>
        {monthIncomes.length === 0 && <div style={{ fontSize: 12, color: '#6b7280' }}>Geen losse inkomsten deze maand.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {monthIncomes.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f9fafb', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: '#111827', fontWeight: 500 }}>{i.description}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{i.category} · {i.date}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>{eur(i.amount)}</span>
                <button onClick={() => onEditIncome(i)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>✎</button>
                <button onClick={() => { if (confirm(`"${i.description}" verwijderen?`)) onDeleteIncome(i.id) }} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            </div>
          ))}
          {monthIncomes.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Totaal: <strong style={{ color: '#059669' }}>{eur(extraIncome)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Maandnotitie */}
      <MaandNotitie activeMonth={activeMonth} />
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   MAANDRAPPORT TAB
════════════════════════════════════════════════════════ */
const RAPPORT_QUESTIONS = [
  { id: 'q1', label: 'Hoe was de maand overall?',                    placeholder: 'Goed, redelijk, slecht — en waarom kort.' },
  { id: 'q2', label: 'Zijn de targets gehaald?',                     placeholder: 'Eigen commissie en klantomzet — ja/nee en waardoor.' },
  { id: 'q3', label: 'Welke klant presteerde het beste?',            placeholder: 'Naam + reden.' },
  { id: 'q4', label: 'Welke klant baart zorgen?',                    placeholder: 'Naam + wat is het probleem of risico.' },
  { id: 'q5', label: 'Wat ging er mis deze maand?',                  placeholder: 'Eerlijk. Wat liep niet zoals gepland?' },
  { id: 'q6', label: 'Wat was de grootste win?',                     placeholder: 'Kan financieel zijn, maar ook operationeel of in klantrelatie.' },
  { id: 'q7', label: 'Wat doe je volgend maand anders?',             placeholder: 'Max 2 concrete aanpassingen.' },
  { id: 'q8', label: 'Is er een klant die hernieuwd moet worden?',   placeholder: 'Naam + actie.' },
  { id: 'q9', label: 'Hoe staat de pipeline er voor?',               placeholder: 'Lopende gesprekken, kansen, verwachte nieuwe klanten.' },
  { id: 'q10', label: 'Vrije notitie — wat wil je onthouden?',       placeholder: 'Alles wat niet in de andere vragen past.' },
]

type RapportStore = Record<string, Record<string, string>> // key: YYYY-MM → { questionId: answer }

function MaandrapportTab({ activeMonth }: { activeMonth: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const storageKey = `bouwcheck_rapport_${activeMonth}`

  useEffect(() => {
    dbGet(storageKey).then(val => setAnswers(val ?? {}))
  }, [activeMonth, storageKey])

  const save = (questionId: string, value: string) => {
    const next = { ...answers, [questionId]: value }
    setAnswers(next)
    dbSet(storageKey, next)
  }

  const filled = RAPPORT_QUESTIONS.filter(q => answers[q.id]?.trim()).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Maandrapport — {monthLabel(activeMonth)}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{filled} / {RAPPORT_QUESTIONS.length} vragen ingevuld</div>
        </div>
        {filled === RAPPORT_QUESTIONS.length && (
          <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#10b98115', border: '1px solid #10b98140', color: '#10b981' }}>Compleet</span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(filled / RAPPORT_QUESTIONS.length) * 100}%`, background: '#6366f1', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {RAPPORT_QUESTIONS.map((q, i) => (
          <div key={q.id} style={{ ...CARD, padding: '14px 18px' }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 8 }}>
              <span style={{ color: '#9ca3af', marginRight: 8 }}>{i + 1}.</span>
              {q.label}
            </label>
            <textarea
              rows={2}
              placeholder={q.placeholder}
              value={answers[q.id] ?? ''}
              onChange={e => save(q.id, e.target.value)}
              style={{ ...INPUT, resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════════════════════ */

function TargetKpiCard({ label, actual, target, color, sub, onTargetChange, autoTarget = false }: {
  label: string; actual: number; target: number; color: string; sub: string
  onTargetChange: (v: number) => void; autoTarget?: boolean
}) {
  const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const startEdit = () => { setDraft(target > 0 ? String(target) : ''); setEditing(true) }
  const commit = () => { const v = parseInt(draft); if (!isNaN(v) && v >= 0) onTargetChange(v); setEditing(false) }
  return (
    <div style={CARD}>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{eur(actual)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: target > 0 ? 8 : 0 }}>
        {editing ? (
          <input autoFocus type="number" value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            style={{ width: '100%', padding: '4px 7px', borderRadius: 5, fontSize: 12, background: '#f8fafc', border: `1px solid #e2e8f0`, color: '#0f172a', outline: 'none' }}
            placeholder="Target (€)" />
        ) : (
          <button onClick={autoTarget ? undefined : startEdit}
            style={{ fontSize: 11, color: target > 0 ? '#64748b' : '#cbd5e1', background: 'none', border: 'none', cursor: autoTarget ? 'default' : 'pointer', padding: 0, textAlign: 'left' }}>
            {target > 0
              ? <>{autoTarget && <span style={{ color, opacity: 0.7, marginRight: 4 }}>↑</span>}{`Target: ${eur(target)}`}</>
              : '+ Target instellen'}
          </button>
        )}
        {target > 0 && !editing && (
          <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 'auto', color: pct >= 100 ? '#22c55e' : pct >= 60 ? color : '#f59e0b',
            background: pct >= 100 ? '#f0fdf4' : pct >= 60 ? color + '14' : '#fffbeb',
            padding: '2px 7px', borderRadius: 20 }}>
            {pct}%
          </span>
        )}
      </div>
      {target > 0 && <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2 }}><div style={{ height: 3, background: color, borderRadius: 2, width: `${pct}%`, transition: 'width 0.4s' }} /></div>}
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{sub}</div>
    </div>
  )
}

function CompanyCard({ company: c, entry, month, monthly, onEditEntry, onClickDetail, onEditCompany }: {
  company: Company; entry: MonthEntry; month: string; monthly: MonthlyStore
  onEditEntry: () => void; onClickDetail: () => void; onEditCompany: () => void
}) {
  const div = DIVISIONS.find(d => d.id === c.division)!
  const ownPct = c.ownRevenueTarget > 0 ? Math.min((entry.monthlyFee / c.ownRevenueTarget) * 100, 100) : 0
  const clientPct = c.clientRevenueTarget > 0 ? Math.min((entry.revenueGenerated / c.clientRevenueTarget) * 100, 100) : 0
  const hasData = entry.monthlyFee > 0 || entry.revenueGenerated > 0 || entry.leadsReceived > 0

  return (
    <div style={{ ...CARD, position: 'relative', cursor: 'default', borderLeft: `4px solid ${div.color}`, paddingLeft: 16 }}>
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={{ width: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{ fontSize: 13, fontWeight: 700, color: '#111827', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onClick={onClickDetail}
            >{c.name}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: div.color, marginTop: 1 }}>{div.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <button onClick={onEditCompany}
            title="Bedrijf & targets bewerken"
            style={{ padding: '4px 8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, color: '#374151', cursor: 'pointer' }}>
            ⚙
          </button>
          <button onClick={onEditEntry}
            style={{ padding: '4px 10px', background: hasData ? '#f9fafb' : '#eef2ff', border: `1px solid ${hasData ? '#e5e7eb' : '#c7d2fe'}`, borderRadius: 6, fontSize: 11, color: hasData ? '#374151' : '#4f46e5', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: hasData ? 400 : 600 }}>
            {hasData ? '✎' : '+'} Invullen
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <Metric label="Commissie" value={eur(entry.monthlyFee)} target={c.ownRevenueTarget > 0 ? eur(c.ownRevenueTarget) : null} pct={ownPct} color="#10b981" />
        <Metric label="Gegenereerd" value={eur(entry.revenueGenerated)} target={c.clientRevenueTarget > 0 ? eur(c.clientRevenueTarget) : null} pct={clientPct} color="#6366f1" />
        <Metric label="Ad budget" value={c.adBudget > 0 ? eur(c.adBudget) : '—'} target={null} pct={0} color="#38bdf8" />
      </div>
      {(() => {
        if (!c.adBudget) return null
        if (!c.adBudgetPaidDate) return (
          <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>⚠</span><span>Ad budget nog niet betaald</span>
          </div>
        )
        const lastPaid = new Date(c.adBudgetPaidDate)
        const nextDue = new Date(lastPaid)
        nextDue.setMonth(nextDue.getMonth() + 1)
        const daysUntil = Math.ceil((nextDue.getTime() - Date.now()) / 86400000)
        if (c.leadsTarget > 0) return (
          <div style={{ fontSize: 11, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>✓</span><span>Ad budget betaald op {c.adBudgetPaidDate.split('-').reverse().join('-')}</span>
          </div>
        )
        if (daysUntil < 0) return (
          <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8, padding: '5px 8px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>🔴</span><span>Ad budget {Math.abs(daysUntil)} dag{Math.abs(daysUntil) !== 1 ? 'en' : ''} te laat — verwacht {nextDue.toLocaleDateString('nl-NL')}</span>
          </div>
        )
        if (daysUntil <= 7) return (
          <div style={{ fontSize: 11, color: '#d97706', marginBottom: 8, padding: '5px 8px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>⚠</span><span>{daysUntil === 0 ? 'Ad budget vandaag verwacht' : `Ad budget over ${daysUntil} dag${daysUntil !== 1 ? 'en' : ''} verwacht`} — {nextDue.toLocaleDateString('nl-NL')}</span>
          </div>
        )
        return (
          <div style={{ fontSize: 11, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>✓</span><span>Ad budget betaald op {c.adBudgetPaidDate.split('-').reverse().join('-')} — volgende {nextDue.toLocaleDateString('nl-NL')}</span>
          </div>
        )
      })()}

      {/* Leads progress — cumulative across all months */}
      {(() => {
        const totalLeads = Object.entries(monthly)
          .filter(([k]) => k.startsWith(c.id + '_'))
          .reduce((s, [, e]) => s + e.leadsReceived, 0)
        const leadsPct = c.leadsTarget > 0 ? Math.min((totalLeads / c.leadsTarget) * 100, 100) : 0
        const leadsColor = leadsPct >= 100 ? '#10b981' : leadsPct >= 60 ? '#f59e0b' : '#6366f1'
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
              <span style={{ color: '#374151' }}>Ontvangen leads</span>
              <span style={{ color: '#374151' }}>
                {totalLeads}{c.leadsTarget > 0 ? ` / ${c.leadsTarget}` : ''}
                {c.leadsTarget > 0 && <span style={{ color: leadsColor, marginLeft: 5 }}>{Math.round(leadsPct)}%</span>}
              </span>
            </div>
            {c.leadsTarget > 0 && (
              <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${leadsPct}%`, background: leadsColor, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function Metric({ label, value, target, pct, color }: { label: string; value: string; target: string | null; pct: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
      {target && (
        <>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1, marginBottom: 2 }}>{Math.round(pct)}% v {target}</div>
          <div style={{ height: 3, background: '#e5e7eb', borderRadius: 2 }}>
            <div style={{ height: 3, background: color, borderRadius: 2, width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  )
}

function DetailView({ company: c, monthly, onEdit, onClose }: { company: Company; monthly: MonthlyStore; onEdit: () => void; onClose: () => void }) {
  const div = DIVISIONS.find(d => d.id === c.division)!
  // Last 6 months of data
  const months = lastSixMonths(thisMonth())
  const totalLeads = months.reduce((s, m) => s + (monthly[entryKey(c.id, m)]?.leadsReceived ?? 0), 0)
  const leadsLeft = Math.max(0, c.leadsTarget - totalLeads)
  const pct = c.leadsTarget > 0 ? Math.min((totalLeads / c.leadsTarget) * 100, 100) : 0

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{c.name}</h2>
          <span style={{ fontSize: 12, fontWeight: 600, color: div.color }}>{div.label}</span>
          <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 10 }}>actief vanaf {monthLabel(c.startMonth)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onEdit} style={{ padding: '6px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, color: '#374151', fontSize: 12, cursor: 'pointer' }}>Bewerken</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
      </div>

      {/* Static targets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Ad budget',                  value: eur(c.adBudget),              color: '#0f172a' },
          { label: 'Commissie target / maand',   value: eur(c.ownRevenueTarget),      color: '#4f46e5' },
          { label: 'Gegenereerd target / maand', value: eur(c.clientRevenueTarget),   color: '#0ea5e9' },
          { label: 'Commissie target / jaar',    value: eur(c.ownRevenueTarget * 12), color: '#0f172a' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly history */}
      <div style={{ background: '#ffffff', borderRadius: 8, overflow: 'hidden', marginBottom: 14, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1 }}>MAANDOVERZICHT</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
              {['Maand', 'Commissie', 'Gegenereerd', 'Leads'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 14px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.4px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.reverse().map((m, i) => {
              const e = monthly[entryKey(c.id, m)] ?? ENTRY_EMPTY
              const isEmpty = e.monthlyFee === 0 && e.revenueGenerated === 0 && e.leadsReceived === 0
              return (
                <tr key={m} style={{ borderBottom: i < months.length - 1 ? '1px solid #f3f4f6' : 'none', opacity: isEmpty ? 0.4 : 1 }}>
                  <td style={{ padding: '7px 14px', color: '#6b7280', fontWeight: 500 }}>{monthLabel(m)}</td>
                  <td style={{ padding: '7px 14px', color: '#059669', fontWeight: isEmpty ? 400 : 700 }}>{eur(e.monthlyFee)}</td>
                  <td style={{ padding: '7px 14px', color: '#7c3aed', fontWeight: isEmpty ? 400 : 700 }}>{eur(e.revenueGenerated)}</td>
                  <td style={{ padding: '7px 14px', color: '#374151', fontWeight: isEmpty ? 400 : 600 }}>{e.leadsReceived > 0 ? e.leadsReceived : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Leads contract */}
      {c.leadsTarget > 0 && (
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Contract leads voortgang</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 80 ? '#dc2626' : '#111827' }}>{totalLeads} / {c.leadsTarget} ({Math.round(pct)}%)</span>
          </div>
          <div style={{ height: 7, background: '#e5e7eb', borderRadius: 4 }}>
            <div style={{ height: 7, background: pct >= 80 ? '#dc2626' : div.color, borderRadius: 4, width: `${pct}%` }} />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
            {leadsLeft > 0 ? `${leadsLeft} leads resterend` : '✓ Contract vol'} {pct >= 80 && '· ⚠ Bijna vol — hernieuwing plannen'}
          </div>
        </div>
      )}

      {c.notes && <div style={{ fontSize: 12, color: '#374151', borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 14, lineHeight: 1.6 }}>{c.notes}</div>}
    </>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#ffffff', borderRadius: 16, padding: 28, width: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)' }}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 18 }}>✕</button>
    </div>
  )
}

