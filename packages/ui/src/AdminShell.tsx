'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

export type AdminNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  active?: boolean;
};

export type AdminBreadcrumb = {
  label: string;
  href?: string;
};

export type AdminShellProps = {
  primaryNav: AdminNavItem[];
  secondaryNav?: AdminNavItem[];
  breadcrumbs?: AdminBreadcrumb[];
  title: string;
  actions?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  productName?: string;
};

export function AdminShell({
  primaryNav,
  secondaryNav = [],
  breadcrumbs = [],
  title,
  actions,
  controls,
  children,
  productName = 'Lotavi',
}: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`gp-admin-shell${collapsed ? ' gp-admin-shell--collapsed' : ''}`}>
      <aside className="gp-admin-shell__primary">
        <div className="gp-admin-shell__brand">
          <span aria-hidden="true">L</span>
          <strong className="gp-admin-shell__brand-name">{productName}</strong>
        </div>
        <button
          className="gp-admin-shell__collapse"
          type="button"
          aria-label={collapsed ? 'Expand primary navigation' : 'Collapse primary navigation'}
          aria-pressed={collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? '»' : '«'}
        </button>
        <nav className="gp-admin-shell__nav" aria-label="Primary navigation">
          {primaryNav.map((item) => (
            <a
              key={item.href}
              className={`gp-admin-shell__nav-link${item.active ? ' is-active' : ''}`}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span className="gp-admin-shell__nav-mark" aria-hidden="true">
                {item.shortLabel ?? item.label.slice(0, 1)}
              </span>
              <span className="gp-admin-shell__nav-label">{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>
      <aside className="gp-admin-shell__secondary">
        <div className="gp-admin-shell__controls">{controls}</div>
        <nav className="gp-admin-shell__secondary-nav" aria-label="Secondary navigation">
          {secondaryNav.map((item) => (
            <a
              key={item.href}
              className={`gp-admin-shell__secondary-link${item.active ? ' is-active' : ''}`}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="gp-admin-shell__main">
        <header className="gp-admin-shell__header">
          <div className="gp-admin-shell__heading">
            {breadcrumbs.length ? (
              <nav className="gp-admin-shell__breadcrumbs" aria-label="Breadcrumb">
                {breadcrumbs.map((item, index) =>
                  item.href ? (
                    <a key={`${item.href}-${index}`} href={item.href}>
                      {item.label}
                    </a>
                  ) : (
                    <span key={`${item.label}-${index}`} aria-current="page">
                      {item.label}
                    </span>
                  ),
                )}
              </nav>
            ) : null}
            <h1>{title}</h1>
          </div>
          {actions ? <div className="gp-admin-shell__actions">{actions}</div> : null}
        </header>
        <div className="gp-admin-shell__workspace">{children}</div>
      </main>
    </div>
  );
}
