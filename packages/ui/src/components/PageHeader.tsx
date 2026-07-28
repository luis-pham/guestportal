import type { ReactNode } from 'react';

export type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, actions, meta }: PageHeaderProps) {
  return (
    <header className="gp-page-header">
      <div className="gp-page-header__copy">
        {eyebrow ? <p className="gp-page-header__eyebrow">{eyebrow}</p> : null}
        <h2 className="gp-page-header__title">{title}</h2>
        {description ? <p className="gp-page-header__description">{description}</p> : null}
        {meta ? <div className="gp-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="gp-page-header__actions">{actions}</div> : null}
    </header>
  );
}
