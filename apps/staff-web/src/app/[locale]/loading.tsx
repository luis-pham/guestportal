export default function Loading() {
  return (
    <main className="gp-state" aria-busy="true" data-testid="route-loading">
      <span className="gp-skeleton" style={{ width: '12rem' }} />
      <span className="gp-skeleton" />
      <span className="gp-skeleton" />
    </main>
  );
}
