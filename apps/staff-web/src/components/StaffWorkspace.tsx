'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { roleHasPermission, type Permission, type Role } from '../../../../packages/auth/src/roles';
import { Button, Select, StaffShell } from '@guestportal/ui';
import { apiFetch } from '../lib/api';
import { formatCurrency, formatDate, formatNumber } from '../i18n/format';
import { resolveLocale, type AppLocale } from '../i18n/config';
import { localeHref, persistLocalePreference } from '../lib/locale';

type MeResponse = {
  user: { displayName: string; email: string };
  memberships: Array<{ organizationId: string; role: Role; propertyIds: string[] }>;
  activeOrganizationId: string | null;
};

type OrgResponse = {
  organizations: Array<{ id: string; name: string; slug: string }>;
};

type PropertiesResponse = {
  properties: Array<{ id: string; name: string; slug: string }>;
};

type RouteKey = 'inbox' | 'myWork' | 'messages' | 'history' | 'settings' | 'more' | 'request' | 'order';

const STAFF_PERMISSION: Permission = 'request.read';

function resolveRouteKey(pathname: string): RouteKey {
  if (pathname.includes('/requests/')) return 'request';
  if (pathname.includes('/orders/')) return 'order';
  if (pathname.includes('/my-work')) return 'myWork';
  if (pathname.includes('/messages')) return 'messages';
  if (pathname.includes('/history')) return 'history';
  if (pathname.includes('/settings')) return 'settings';
  if (pathname.includes('/more')) return 'more';
  return 'inbox';
}

export function StaffWorkspace({
  routeKey,
  detailId,
}: {
  routeKey?: RouteKey;
  detailId?: string;
}) {
  const t = useTranslations('shell');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = routeKey ?? resolveRouteKey(pathname);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [orgs, setOrgs] = useState<OrgResponse['organizations']>([]);
  const [properties, setProperties] = useState<PropertiesResponse['properties']>([]);
  const [orgId, setOrgId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [denied, setDenied] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const meResult = await apiFetch<MeResponse>('/v1/me');
      if (!meResult.ok) {
        router.replace(`/${locale}/login`);
        return;
      }
      setMe(meResult.data);
      persistLocalePreference(resolveLocale(locale));
      const orgResult = await apiFetch<OrgResponse>('/v1/organizations');
      if (orgResult.ok) {
        setOrgs(orgResult.data.organizations);
        const first = meResult.data.activeOrganizationId ?? orgResult.data.organizations[0]?.id;
        if (first) setOrgId(first);
      }
    })();
  }, [locale, router]);

  useEffect(() => {
    if (!orgId) return;
    void (async () => {
      const result = await apiFetch<PropertiesResponse>(`/v1/properties?organizationId=${orgId}`);
      if (result.status === 403) {
        setDenied(true);
        setProperties([]);
        return;
      }
      setDenied(false);
      if (result.ok) {
        setProperties(result.data.properties);
        setPropertyId((current) =>
          result.data.properties.some((property) => property.id === current)
            ? current
            : (result.data.properties[0]?.id ?? ''),
        );
      }
    })();
  }, [orgId]);

  const role = useMemo(
    () => me?.memberships.find((membership) => membership.organizationId === orgId)?.role,
    [me, orgId],
  );
  const canStaff = Boolean(role && roleHasPermission(role, STAFF_PERMISSION));

  async function logout() {
    await apiFetch('/v1/auth/logout', { method: 'POST' });
    router.replace(`/${locale}/login`);
  }

  if (!me) {
    return (
      <main className="gp-state" data-testid="staff-loading">
        {t('loading')}
      </main>
    );
  }

  const localePrefix = `/${locale}`;
  const route = (path: string) => `${localePrefix}${path}`;
  const propertyName = properties.find((property) => property.id === propertyId)?.name ?? '';
  const nextLocale: AppLocale = locale === 'vi' ? 'en' : 'vi';
  const sampleInstant = new Date('2026-07-26T10:30:00+07:00');

  const desktopNav = canStaff
    ? [
        {
          href: route('/inbox'),
          label: t('routes.inbox'),
          shortLabel: 'I',
          active: activeKey === 'inbox',
        },
        {
          href: route('/my-work'),
          label: t('routes.myWork'),
          shortLabel: 'W',
          active: activeKey === 'myWork',
        },
        {
          href: route('/messages'),
          label: t('routes.messages'),
          shortLabel: 'M',
          active: activeKey === 'messages',
        },
      ]
    : [];

  const moreNav = canStaff
    ? [
        {
          href: route('/history'),
          label: t('routes.history'),
          active: activeKey === 'history',
        },
        {
          href: route('/settings'),
          label: t('routes.settings'),
          active: activeKey === 'settings',
        },
      ]
    : [];

  const mobileNav = canStaff
    ? [
        ...desktopNav,
        {
          href: route('/more'),
          label: t('routes.more'),
          shortLabel: '+',
          active: activeKey === 'more' || activeKey === 'history' || activeKey === 'settings',
        },
      ]
    : [];

  return (
    <StaffShell
      title={t(`titles.${activeKey}`)}
      subtitle={t(`subtitles.${activeKey}`)}
      desktopNav={desktopNav}
      mobileNav={mobileNav}
      moreNav={moreNav}
      offline={offline}
      headerControls={
        <>
          <Select
            label={t('organization')}
            data-testid="org-switcher"
            value={orgId}
            onChange={(event) => setOrgId(event.target.value)}
            options={orgs.map((org) => ({ value: org.id, label: org.name }))}
          />
          <Select
            label={t('property')}
            data-testid="property-switcher"
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
            disabled={denied || properties.length === 0}
            options={properties.map((property) => ({ value: property.id, label: property.name }))}
          />
        </>
      }
      actions={
        <>
          <a
            data-testid="locale-switch"
            className="gp-btn gp-btn--ghost"
            aria-label={t('localeSwitch')}
            href={localeHref(nextLocale, pathname)}
            onClick={() => persistLocalePreference(nextLocale)}
          >
            {nextLocale === 'en' ? 'EN' : 'VI'}
          </a>
          <Button data-testid="logout-button" variant="secondary" onClick={() => void logout()}>
            {t('logout')}
          </Button>
        </>
      }
    >
      <section className="gp-state" data-testid="staff-workspace">
        {!canStaff ? (
          <p data-testid="access-denied">{t('accessDenied')}</p>
        ) : (
          <>
            <p className="gp-state__body">{t('workspaceBody')}</p>
            <p data-testid="long-fixture">{t('longFixture')}</p>
            <p data-testid="sample-date">{t('sampleDate', { value: formatDate(sampleInstant, locale) })}</p>
            <p data-testid="sample-number">{t('sampleNumber', { value: formatNumber(1234567.89, locale) })}</p>
            <p data-testid="sample-currency">
              {t('sampleCurrency', { value: formatCurrency(150000, locale) })}
            </p>
            {denied ? <p data-testid="access-denied">{t('accessDenied')}</p> : null}
            <p data-testid="property-context">
              {properties.length
                ? t('propertyContext', { property: propertyName })
                : t('noProperties')}
            </p>
            <p data-testid="empty-queue">{t('emptyQueue')}</p>
            {detailId ? <p data-testid="detail-id">{detailId}</p> : null}
            <p data-testid="admin-only-note">{t('adminOnlyBlocked')}</p>
            <ul data-testid="staff-user">
              <li>{me.user.displayName}</li>
              <li>{me.user.email}</li>
              <li>{role}</li>
            </ul>
          </>
        )}
      </section>
    </StaffShell>
  );
}
