import { contractorLeaderboard } from '../../../lib/metrics'
import { ContractorsTable } from '../../components/contractors/ContractorsTable'

export const dynamic = 'force-dynamic'

export default async function ContractorsPage() {
  const contractors = await contractorLeaderboard()

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize:   'var(--font-size-2xl)',
          fontWeight: 600,
          color:      'var(--color-ink)',
          margin:     0,
        }}>
          Contractors
        </h1>
        <p style={{
          fontSize:  'var(--font-size-sm)',
          color:     'var(--color-ink-muted)',
          marginTop: 4,
        }}>
          Alle data · {contractors.length} actieve contractors
        </p>
      </div>

      <ContractorsTable contractors={contractors} />
    </div>
  )
}
