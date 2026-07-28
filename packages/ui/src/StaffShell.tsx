'use client';

import type { ReactNode } from 'react';

export type StaffNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  active?: boolean;
};

export type StaffShellProps = {
  desktopNav: StaffNavItem[];
  mobileNav: StaffNavItem[];
  moreNav?: StaffNavItem[];
  title: string;
  subtitle?: string;
  headerControls?: ReactNode;
  actions?: ReactNode;
  offline?: boolean;
  children: ReactNode;
  productName?: string;
};

export function StaffShell({
  desktopNav,
  mobileNav,
  moreNav = [],
  title,
  subtitle,
  headerControls,
  actions,
  offline = false,
  children,
  productName = 'Lotavi Staff',
}: StaffShellProps) {
  return (
    <div className={`gp-staff-shell${offline ? ' gp-staff-shell--offline' : ''}`}>
      {offline ? (
        <div className="gp-staff-shell__offline" role="status" data-testid="offline-banner">
          Offline - reconnecting when the network returns. Local shell state is preserved.
        </div>
      ) : null}

      <a className="gp-staff-shell__skip" href="#staff-workspace">
        Skip to staff workspace
      </a>

      <aside className="gp-staff-shell__sidebar">
        <div className="gp-staff-shell__brand">
          <span aria-hidden="true">L</span>
          <strong>{productName}</strong>
        </div>
        {desktopNav.length ? (
          <nav className="gp-staff-shell__desktop-nav" aria-label="Staff navigation">
            {desktopNav.map((item) => (
              <a
                key={item.href}
                className={`gp-staff-shell__nav-link${item.active ? ' is-active' : ''}`}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
              >
                <span className="gp-staff-shell__nav-mark" aria-hidden="true">
                  {item.shortLabel ?? item.label.slice(0, 1)}
                </span>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        ) : null}
        {moreNav.length ? (
          <nav className="gp-staff-shell__more-nav" aria-label="More staff destinations">
            {moreNav.map((item) => (
              <a
                key={item.href}
                className={`gp-staff-shell__nav-link${item.active ? ' is-active' : ''}`}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
      </aside>

      <div className="gp-staff-shell__frame">
        <header className="gp-staff-shell__header">
          <div className="gp-staff-shell__heading">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="gp-staff-shell__header-end">
            {headerControls}
            {actions}
          </div>
        </header>
        <main className="gp-staff-shell__workspace" id="staff-workspace" tabIndex={-1}>
          {children}
        </main>
      </div>

      {mobileNav.length ? (
        <nav className="gp-staff-shell__mobile-nav" aria-label="Mobile staff navigation">
          {mobileNav.map((item) => (
            <a
              key={item.href}
              className={`gp-staff-shell__mobile-link${item.active ? ' is-active' : ''}`}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
            >
              <span className="gp-staff-shell__mobile-mark" aria-hidden="true">
                {item.shortLabel ?? item.label.slice(0, 1)}
              </span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
