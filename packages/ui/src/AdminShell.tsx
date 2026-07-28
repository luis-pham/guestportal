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
          <div className="gp-admin-shell__brand-copy">
            <strong className="gp-admin-shell__brand-name">{productName}</strong>
            <small>Hotel workspace</small>
          </div>
        </div>
        <nav className="gp-admin-shell__nav" aria-label="Primary navigation">
          <p className="gp-admin-shell__nav-group">Workspace</p>
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
        {secondaryNav.length ? (
          <nav className="gp-admin-shell__secondary-nav" aria-label="Secondary navigation">
            <p className="gp-admin-shell__nav-group">Section</p>
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
        ) : null}
        <button
          className="gp-admin-shell__collapse"
          type="button"
          aria-label={collapsed ? 'Expand primary navigation' : 'Collapse primary navigation'}
          aria-pressed={collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
          <span className="gp-admin-shell__collapse-label">Collapse</span>
        </button>
      </aside>
      <main className="gp-admin-shell__main">
        <header className="gp-admin-shell__header">
          <button className="gp-admin-shell__search" type="button">
            <span aria-hidden="true">⌕</span>
            <span>Search guests, orders, rooms...</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="gp-admin-shell__top-controls">{controls}</div>
          <div className="gp-admin-shell__top-actions">
            <button className="gp-admin-shell__create" type="button">
              + Create
            </button>
            {actions}
          </div>
        </header>
        <div className="gp-admin-shell__route-context" aria-label="Workspace context">
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
          <span>{title}</span>
        </div>
        <div className="gp-admin-shell__workspace">{children}</div>
      </main>
    </div>
  );
}
