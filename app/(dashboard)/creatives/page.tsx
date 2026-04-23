export default function CreativesPage() {
  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
          Creatives
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)', marginTop: 4 }}>
          Advertentiecreatives en prestaties
        </p>
      </div>
      <div style={{
        height: 200, background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--color-ink-faint)', fontSize: 'var(--font-size-sm)',
      }}>
        Komt in Phase 4G
      </div>
    </div>
  )
}
