export default function GuestHomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, var(--gp-color-surface-muted), var(--gp-color-background))',
        color: 'var(--gp-color-text-primary)',
        fontFamily: 'var(--gp-font-sans)',
        padding: 'var(--gp-space-32)',
      }}
    >
      <p style={{ color: 'var(--gp-color-text-muted)', marginBottom: 'var(--gp-space-8)' }}>
        Guest
      </p>
      <h1 style={{ marginTop: 0 }}>Guest portal foundation</h1>
      <p style={{ color: 'var(--gp-color-text-secondary)', maxWidth: 480 }}>
        Phase 00 placeholder. QR resolve, branding, chat and orders land in later phases.
      </p>
    </main>
  );
}
