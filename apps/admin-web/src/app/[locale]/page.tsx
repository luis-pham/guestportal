'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
// Import the browser-safe permission matrix directly. The package root also exports
// server session helpers, which must not be bundled into this client component.
import {
  roleHasPermission,
  type Permission,
  type Role,
} from '../../../../../packages/auth/src/roles';
import { AdminShell, Button, Select } from '@guestportal/ui';
import { apiFetch } from '../../lib/api';
import { formatCurrency, formatDate, formatNumber } from '../../i18n/format';
import { resolveLocale, type AppLocale } from '../../i18n/config';
import { localeHref, persistLocalePreference } from '../../lib/locale';
import { BrandingForm } from '../../components/BrandingForm';
import { PortalBuilderWorkspace } from '../../components/PortalBuilderWorkspace';
import { PortalNavigationEditor } from '../../components/PortalNavigationEditor';
import { PortalPreviewPanel } from '../../components/PortalPreviewPanel';
import { PortalPublishHistory } from '../../components/PortalPublishHistory';
import { QrCodesPanel } from '../../components/QrCodesPanel';
import { KnowledgeSourcesPanel } from '../../components/KnowledgeSourcesPanel';
import { KnowledgeSearchPanel } from '../../components/KnowledgeSearchPanel';
import { PropertySettingsForm } from '../../components/PropertySettingsForm';
import { AdminOperationsPanel } from '../../components/AdminOperationsPanel';
import { AdminTeamPanel } from '../../components/AdminTeamPanel';
import { AdminAnalyticsDashboard } from '../../components/AdminAnalyticsDashboard';
import { AdminAuditLogPanel } from '../../components/AdminAuditLogPanel';
import {
  OrganizationSettingsPanel,
  SecuritySettingsPanel,
} from '../../components/OrganizationSettingsPanel';

type MeResponse = {
  user: { displayName: string; email: string; locale?: string };
  memberships: Array<{ organizationId: string; role: Role; propertyIds: string[] }>;
  activeOrganizationId: string | null;
};

type OrgResponse = {
  organizations: Array<{ id: string; name: string; slug: string }>;
};

type PropertiesResponse = {
  properties: Array<{ id: string; name: string; slug: string }>;
};

type ModuleId =
  | 'overview'
  | 'portal'
  | 'knowledge'
  | 'catalog'
  | 'operations'
  | 'analytics'
  | 'team'
  | 'settings';

type Module = {
  id: ModuleId;
  permission: Permission;
  href: (propertyId?: string) => string;
  secondary: Array<{ labelKey: string; suffix: string; permission: Permission }>;
};

const modules: Module[] = [
  {
    id: 'overview',
    permission: 'property.read',
    href: () => '/properties',
    secondary: [
      { labelKey: 'properties', suffix: '', permission: 'property.read' },
      { labelKey: 'propertySettings', suffix: '/settings', permission: 'property.update' },
    ],
  },
  {
    id: 'portal',
    permission: 'portal.read',
    href: (propertyId) => `/properties/${propertyId ?? 'select-property'}/portal`,
    secondary: [
      { labelKey: 'overview', suffix: '', permission: 'portal.read' },
      { labelKey: 'branding', suffix: '/branding', permission: 'portal.update' },
      { labelKey: 'navigation', suffix: '/navigation', permission: 'portal.update' },
      { labelKey: 'homepage', suffix: '/homepage', permission: 'portal.update' },
      { labelKey: 'pages', suffix: '/pages', permission: 'portal.update' },
      { labelKey: 'quickActions', suffix: '/quick-actions', permission: 'portal.update' },
      { labelKey: 'preview', suffix: '/preview', permission: 'portal.read' },
      { labelKey: 'publishHistory', suffix: '/publish-history', permission: 'portal.publish' },
    ],
  },
  {
    id: 'knowledge',
    permission: 'knowledge.read',
    href: (propertyId) => `/properties/${propertyId ?? 'select-property'}/knowledge`,
    secondary: [
      { labelKey: 'sources', suffix: '', permission: 'knowledge.read' },
      { labelKey: 'searchTest', suffix: '/search', permission: 'knowledge.read' },
      { labelKey: 'missingAnswers', suffix: '/missing-answers', permission: 'knowledge.read' },
    ],
  },
  {
    id: 'catalog',
    permission: 'catalog.read',
    href: (propertyId) => `/properties/${propertyId ?? 'select-property'}/catalog`,
    secondary: [
      { labelKey: 'overview', suffix: '', permission: 'catalog.read' },
      { labelKey: 'categories', suffix: '/categories', permission: 'catalog.manage' },
      { labelKey: 'products', suffix: '/products', permission: 'catalog.manage' },
      { labelKey: 'services', suffix: '/services', permission: 'catalog.manage' },
      { labelKey: 'availability', suffix: '/availability', permission: 'catalog.manage' },
    ],
  },
  {
    id: 'operations',
    permission: 'request.read',
    href: (propertyId) => `/properties/${propertyId ?? 'select-property'}/operations/requests`,
    secondary: [
      { labelKey: 'requests', suffix: '/requests', permission: 'request.read' },
      { labelKey: 'orders', suffix: '/orders', permission: 'order.read' },
      { labelKey: 'conversations', suffix: '/conversations', permission: 'conversation.read' },
      { labelKey: 'qrCodes', suffix: '/qr', permission: 'property.update' },
    ],
  },
  {
    id: 'analytics',
    permission: 'analytics.read',
    href: (propertyId) => `/properties/${propertyId ?? 'select-property'}/analytics`,
    secondary: [
      { labelKey: 'overview', suffix: '', permission: 'analytics.read' },
      { labelKey: 'operationsAnalytics', suffix: '/operations', permission: 'analytics.read' },
      { labelKey: 'aiAnalytics', suffix: '/ai', permission: 'analytics.read' },
    ],
  },
  {
    id: 'team',
    permission: 'team.read',
    href: () => '/team',
    secondary: [
      { labelKey: 'members', suffix: '', permission: 'team.read' },
      { labelKey: 'invitations', suffix: '/invitations', permission: 'team.manage' },
    ],
  },
  {
    id: 'settings',
    // Settings includes the audit viewer; secondary items still enforce exact permissions.
    permission: 'audit.read',
    href: () => '/settings/organization',
    secondary: [
      { labelKey: 'organization', suffix: '/organization', permission: 'organization.update' },
      { labelKey: 'security', suffix: '/security', permission: 'security.manage' },
      { labelKey: 'auditLog', suffix: '/audit-log', permission: 'audit.read' },
    ],
  },
];

function pathnameMatchesModule(pathname: string, moduleId: ModuleId, propertyId: string) {
  if (moduleId === 'overview') {
    return (
      pathname.endsWith('/properties') || pathname.endsWith(`/properties/${propertyId}/settings`)
    );
  }
  if (moduleId === 'team') return pathname.includes('/team');
  if (moduleId === 'settings')
    return pathname.includes('/settings') && !pathname.includes('/properties/');
  return pathname.includes(`/${moduleId}`);
}

export default function AdminHomePage() {
  const t = useTranslations('shell');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orgs, setOrgs] = useState<OrgResponse['organizations']>([]);
  const [properties, setProperties] = useState<PropertiesResponse['properties']>([]);
  const [orgId, setOrgId] = useState<string>('');
  const [propertyId, setPropertyId] = useState<string>('');
  const [denied, setDenied] = useState(false);

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
        if (first) {
          setOrgId(first);
        }
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

  async function logout() {
    await apiFetch('/v1/auth/logout', { method: 'POST' });
    router.replace(`/${locale}/login`);
  }

  useEffect(() => {
    document.title = 'GuestPortal Admin';
  }, []);

  if (!me) {
    return <main className="gp-state">{t('loading')}</main>;
  }

  const role = me.memberships.find((membership) => membership.organizationId === orgId)?.role;
  const can = (permission: Permission) => Boolean(role && roleHasPermission(role, permission));
  const activeModule =
    modules.find((module) => pathnameMatchesModule(pathname, module.id, propertyId)) ?? modules[0]!;
  const availablePrimary = modules.filter((module) => can(module.permission));
  const activeSecondary = activeModule.secondary.filter((item) => can(item.permission));
  const localePrefix = `/${locale}`;
  const route = (path: string) => `${localePrefix}${path}`;
  const moduleLabel = t(`modules.${activeModule.id}`);
  const nextLocale: AppLocale = locale === 'vi' ? 'en' : 'vi';
  const sampleInstant = new Date('2026-07-26T10:30:00+07:00');

  return (
    <AdminShell
      title={moduleLabel}
      breadcrumbs={[{ label: t('workspace') }, { label: moduleLabel }]}
      primaryNav={availablePrimary.map((module) => ({
        href: route(module.href(propertyId)),
        label: t(`modules.${module.id}`),
        shortLabel: t(`modules.${module.id}`).slice(0, 1),
        active: activeModule.id === module.id,
      }))}
      secondaryNav={activeSecondary.map((item) => ({
        href: route(
          activeModule.id === 'overview'
            ? item.suffix === '/settings'
              ? `/properties/${propertyId || 'select-property'}/settings`
              : '/properties'
            : activeModule.id === 'team'
              ? `/team${item.suffix}`
              : activeModule.id === 'settings'
                ? `/settings${item.suffix}`
                : `${activeModule.href(propertyId)}${item.suffix}`,
        ),
        label: t(`secondary.${item.labelKey}`),
        active:
          item.suffix === '/settings'
            ? pathname.includes('/settings')
            : item.suffix === '/branding'
              ? pathname.includes('/branding')
              : pathname.endsWith(item.suffix || activeModule.href(propertyId)),
      }))}
      controls={
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
      {pathname.includes('/portal/branding') ? (
        <BrandingForm />
      ) : pathname.includes('/portal/homepage') ? (
        <PortalBuilderWorkspace />
      ) : pathname.includes('/portal/navigation') ? (
        <PortalNavigationEditor />
      ) : pathname.includes('/portal/preview') ? (
        <PortalPreviewPanel />
      ) : pathname.includes('/portal/publish-history') ? (
        <PortalPublishHistory />
      ) : pathname.includes('/operations/requests') ? (
        <AdminOperationsPanel kind="request" />
      ) : pathname.includes('/operations/orders') ? (
        <AdminOperationsPanel kind="order" />
      ) : pathname.includes('/operations/qr') ? (
        <QrCodesPanel />
      ) : pathname.includes('/analytics') ? (
        <AdminAnalyticsDashboard />
      ) : pathname.includes('/knowledge/search') ? (
        <KnowledgeSearchPanel />
      ) : pathname.includes('/knowledge') && !pathname.includes('/missing-answers') ? (
        <KnowledgeSourcesPanel />
      ) : pathname.includes('/team/invitations') ? (
        <AdminTeamPanel organizationId={orgId} properties={properties} invitations />
      ) : pathname.includes('/team') ? (
        <AdminTeamPanel organizationId={orgId} properties={properties} />
      ) : pathname.includes('/settings/audit-log') ? (
        <AdminAuditLogPanel organizationId={orgId} properties={properties} />
      ) : pathname.includes('/settings/security') ? (
        <SecuritySettingsPanel organizationId={orgId} />
      ) : pathname.includes('/settings/organization') ? (
        <OrganizationSettingsPanel organizationId={orgId} />
      ) : pathname.includes('/properties/') && pathname.endsWith('/settings') ? (
        <PropertySettingsForm />
      ) : (
        <section className="gp-state" data-testid="module-workspace">
          <h2 className="gp-state__title">{t('moduleWorkspace', { module: moduleLabel })}</h2>
          <p className="gp-state__body">{t('moduleWorkspaceBody')}</p>
          <p data-testid="long-fixture">{t('longFixture')}</p>
          <p data-testid="sample-date">
            {t('sampleDate', { value: formatDate(sampleInstant, locale) })}
          </p>
          <p data-testid="sample-number">
            {t('sampleNumber', { value: formatNumber(1234567.89, locale) })}
          </p>
          <p data-testid="sample-currency">
            {t('sampleCurrency', { value: formatCurrency(150000, locale) })}
          </p>
          {denied ? <p data-testid="access-denied">{t('accessDenied')}</p> : null}
          <ul data-testid="property-list">
            {properties.map((property) => (
              <li key={property.id}>
                {property.name} ({property.slug})
              </li>
            ))}
          </ul>
          {!denied && properties.length === 0 ? <p>{t('noProperties')}</p> : null}
        </section>
      )}
    </AdminShell>
  );
}
