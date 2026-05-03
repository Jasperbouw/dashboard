import { contractorLeaderboard, currentMonth } from '../../../lib/metrics'
import { ContractorsTable } from '../../components/contractors/ContractorsTable'

export const dynamic = 'force-dynamic'

export default async function ContractorsPage() {
  // Last 30 days for leads/qual/close rate; commission uses current month
  const now  = new Date()
  const last30d = {
    from: new Date(now.getTime() - 30 * 86_400_000),
    to:   now,
  }

  const contractors = await contractorLeaderboard(last30d)

  const criticalCount = contractors.filter(c => c.health === 'critical').length
  const warningCount  = contractors.filter(c => c.health === 'warning').length

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{
            fontSize:   'var(--font-size-2xl)',
            fontWeight: 600,
            color:      'var(--color-ink)',
            margin:     0,
          }}>
            Contractors
          </h1>
          {criticalCount > 0 && (
            <span style={{
              fontSize:     'var(--font-size-xs)',
              fontWeight:   600,
              color:        'var(--color-critical)',
              background:   'var(--color-critical-subtle)',
              borderRadius: 'var(--radius-full)',
              padding:      '2px 8px',
            }}>
              {criticalCount} kritiek
            </span>
          )}
          {warningCount > 0 && (
            <span style={{
              fontSize:     'var(--font-size-xs)',
              fontWeight:   600,
              color:        'var(--color-warning)',
              background:   'var(--color-warning-subtle)',
              borderRadius: 'var(--radius-full)',
              padding:      '2px 8px',
            }}>
              {warningCount} let op
            </span>
          )}
        </div>
        <p style={{
          fontSize:  'var(--font-size-sm)',
          color:     'var(--color-ink-muted)',
          marginTop: 4,
        }}>
          Laatste 30 dagen · {contractors.length} actieve contractors
        </p>
      </div>

      <ContractorsTable contractors={contractors} />
    </div>
  )
}
