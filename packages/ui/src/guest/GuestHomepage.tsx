'use client';

import type { CSSProperties } from 'react';
import type { GuestPortalResponse } from '@guestportal/contracts';

export type GuestHomepageProps = {
  data: GuestPortalResponse;
  labels?: {
    assistantEntry?: string;
    locationPrefix?: string;
  };
};

function pickText(
  localized: { vi?: string; en?: string } | undefined,
  locale: string,
  fallback = '',
): string {
  if (!localized) return fallback;
  if (locale.startsWith('vi') && localized.vi) return localized.vi;
  if (localized.en) return localized.en;
  return localized.vi || fallback;
}

function fontStack(family: GuestPortalResponse['branding']['fontFamily']): string {
  switch (family) {
    case 'serif':
      return 'Georgia, "Times New Roman", serif';
    case 'display':
      return '"Segoe UI Display", "Trebuchet MS", sans-serif';
    case 'system':
      return 'system-ui, -apple-system, sans-serif';
    default:
      return '"Source Sans 3", "Segoe UI", sans-serif';
  }
}

export function GuestHomepage({ data, labels }: GuestHomepageProps) {
  const { branding, portal, location, locale, fallbacks } = data;
  const hero = portal.config.sections.find((section) => section.type === 'hero' && section.enabled);
  const quick = portal.config.sections.find(
    (section) => section.type === 'quick_actions' && section.enabled,
  );

  const style = {
    '--gp-guest-primary': branding.primaryColor,
    '--gp-guest-primary-hover': branding.primaryHoverColor,
    '--gp-guest-accent': branding.accentColor ?? branding.primaryColor,
    '--gp-guest-bg': branding.backgroundColor,
    '--gp-guest-text': branding.textColor,
    '--gp-guest-font': fontStack(branding.fontFamily),
  } as CSSProperties;

  const title =
    hero && hero.type === 'hero'
      ? pickText(hero.title, locale, branding.displayName)
      : branding.displayName;
  const subtitle =
    hero && hero.type === 'hero'
      ? pickText(hero.subtitle, locale, '')
      : pickText(location.name, locale, location.code);

  const actions =
    quick && quick.type === 'quick_actions'
      ? quick.actions.slice(0, 8).map((action) => ({
          id: action.id,
          href: action.href,
          label: pickText(action.label, locale, 'Action'),
          icon: action.icon,
        }))
      : [];

  return (
    <div className="gp-guest-home" data-testid="guest-homepage" style={style}>
      <header className="gp-guest-home__cover" data-testid="guest-cover">
          {branding.coverUrl && !fallbacks.missingCover ? (
          <img className="gp-guest-home__cover-img" src={branding.coverUrl} alt="" />
        ) : (
          <div
            className="gp-guest-home__cover-fallback"
            data-testid="guest-cover-fallback"
            aria-hidden
          />
        )}
        <div className="gp-guest-home__brand-row">
          {branding.logoUrl && !fallbacks.missingLogo ? (
            <img
              className="gp-guest-home__logo"
              data-testid="guest-logo"
              src={branding.logoUrl}
              alt={branding.displayName}
            />
          ) : (
            <div className="gp-guest-home__logo-fallback" data-testid="guest-logo-fallback">
              {branding.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="gp-guest-home__brand-name">{branding.displayName}</p>
            <p className="gp-guest-home__location" data-testid="guest-location">
              {labels?.locationPrefix ?? 'Location'}: {pickText(location.name, locale, location.code)}
            </p>
          </div>
        </div>
      </header>

      <main className="gp-guest-home__main">
        <h1 className="gp-guest-home__title">{title}</h1>
        {subtitle ? <p className="gp-guest-home__subtitle">{subtitle}</p> : null}

        <a className="gp-guest-home__assistant" data-testid="guest-assistant-entry" href="#assistant">
          {labels?.assistantEntry ?? 'Ask the assistant'}
        </a>

        <section className="gp-guest-home__actions" aria-label="Quick actions">
          <ul className="gp-guest-home__action-list" data-testid="guest-quick-actions">
            {actions.map((action) => (
              <li key={action.id}>
                <a className="gp-guest-home__action" href={action.href} data-icon={action.icon}>
                  {action.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
