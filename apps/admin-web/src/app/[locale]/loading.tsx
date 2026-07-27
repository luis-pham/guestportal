export default function Loading() {
  return (
    <main className="gp-state" aria-busy="true">
      <span className="gp-skeleton" style={{ width: '12rem' }} />
      <span className="gp-skeleton" />
      <span className="gp-skeleton" />
    </main>
  );
}
