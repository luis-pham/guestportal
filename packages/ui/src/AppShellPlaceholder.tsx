import type { CSSProperties, ReactNode } from 'react';
import { shellLayout } from './tokens';

export type AppShellPlaceholderProps = {
  surface: 'admin' | 'staff' | 'guest';
  title: string;
  subtitle?: string;
  primaryNav?: string[];
  secondaryNav?: string[];
  children?: ReactNode;
};

const shellStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `${shellLayout.primarySidebarExpanded}px ${shellLayout.secondarySidebarMin}px 1fr`,
  minHeight: '100vh',
  background: 'var(--gp-color-background)',
  color: 'var(--gp-color-text-primary)',
  fontFamily: 'var(--gp-font-sans)',
};

const panelStyle: CSSProperties = {
  borderRight: '1px solid var(--gp-color-border)',
  background: 'var(--gp-color-surface)',
  padding: 'var(--gp-space-24)',
};

export function AppShellPlaceholder({
  surface,
  title,
  subtitle,
  primaryNav = ['Overview', 'Portal', 'Knowledge', 'Catalog', 'Operations'],
  secondaryNav = ['Overview', 'Branding', 'Homepage', 'Preview'],
  children,
}: AppShellPlaceholderProps) {
  return (
    <div data-surface={surface} style={shellStyle}>
      <aside style={panelStyle} aria-label="Primary navigation">
        <div style={{ fontWeight: 700, marginBottom: 'var(--gp-space-24)' }}>GuestPortal</div>
        <nav>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {primaryNav.map((item) => (
              <li key={item} style={{ marginBottom: 'var(--gp-space-12)' }}>
                {item}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <aside style={panelStyle} aria-label="Secondary navigation">
        <div style={{ color: 'var(--gp-color-text-muted)', marginBottom: 'var(--gp-space-16)' }}>
          Module
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {secondaryNav.map((item) => (
            <li key={item} style={{ marginBottom: 'var(--gp-space-12)' }}>
              {item}
            </li>
          ))}
        </ul>
      </aside>
      <main style={{ padding: 'var(--gp-space-32)' }}>
        <header style={{ marginBottom: 'var(--gp-space-24)' }}>
          <p style={{ margin: 0, color: 'var(--gp-color-text-muted)', fontSize: 14 }}>{surface}</p>
          <h1 style={{ margin: 'var(--gp-space-8) 0', fontSize: 28 }}>{title}</h1>
          {subtitle ? (
            <p style={{ margin: 0, color: 'var(--gp-color-text-secondary)' }}>{subtitle}</p>
          ) : null}
        </header>
        <section
          style={{
            background: 'var(--gp-color-surface)',
            border: '1px solid var(--gp-color-border)',
            borderRadius: 'var(--gp-radius-lg)',
            padding: 'var(--gp-space-24)',
            minHeight: 240,
          }}
        >
          {children ?? 'Workspace placeholder - design tokens applied.'}
        </section>
      </main>
    </div>
  );
}
