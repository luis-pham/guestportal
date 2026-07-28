import type { ReactNode } from 'react';

export type FilterBarProps = {
  children: ReactNode;
  actions?: ReactNode;
  activeSummary?: ReactNode;
  'aria-label'?: string;
};

export function FilterBar({
  children,
  actions,
  activeSummary,
  'aria-label': ariaLabel = 'Filters',
}: FilterBarProps) {
  return (
    <section className="gp-filter-bar" aria-label={ariaLabel}>
      <div className="gp-filter-bar__controls">{children}</div>
      {actions ? <div className="gp-filter-bar__actions">{actions}</div> : null}
      {activeSummary ? <div className="gp-filter-bar__summary">{activeSummary}</div> : null}
    </section>
  );
}
