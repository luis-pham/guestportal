'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AppShellPlaceholder } from '@guestportal/ui';
import { apiFetch } from '../../lib/api';

type MeResponse = {
  user: { displayName: string; email: string };
  memberships: Array<{ organizationId: string; role: string; propertyIds: string[] }>;
  activeOrganizationId: string | null;
};

type OrgResponse = {
  organizations: Array<{ id: string; name: string; slug: string }>;
};

type PropertiesResponse = {
  properties: Array<{ id: string; name: string; slug: string }>;
};

export default function AdminHomePage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orgs, setOrgs] = useState<OrgResponse['organizations']>([]);
  const [properties, setProperties] = useState<PropertiesResponse['properties']>([]);
  const [orgId, setOrgId] = useState<string>('');
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    void (async () => {
      const meResult = await apiFetch<MeResponse>('/v1/me');
      if (!meResult.ok) {
        router.replace(`/${locale}/login`);
        return;
      }
      setMe(meResult.data);
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
      }
    })();
  }, [orgId]);

  async function logout() {
    await apiFetch('/v1/auth/logout', { method: 'POST' });
    router.replace(`/${locale}/login`);
  }

  if (!me) {
    return <main style={{ padding: 32 }}>Loading...</main>;
  }

  return (
    <AppShellPlaceholder
      surface="admin"
      title={t('title')}
      subtitle={t('welcome', { name: me.user.displayName })}
      primaryNav={[
        'Overview',
        'Portal',
        'Knowledge',
        'Catalog',
        'Operations',
        'Analytics',
        'Team',
        'Settings',
      ]}
      secondaryNav={['Dashboard', 'Properties']}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            {t('organization')}{' '}
            <select
              data-testid="org-switcher"
              value={orgId}
              onChange={(event) => setOrgId(event.target.value)}
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <a data-testid="locale-switch" href={`/${locale === 'vi' ? 'en' : 'vi'}`}>
            {t('locale')}: {locale === 'vi' ? 'EN' : 'VI'}
          </a>
          <button data-testid="logout-button" type="button" onClick={() => void logout()}>
            {t('logout')}
          </button>
        </div>
        <section>
          <h2>{t('properties')}</h2>
          {denied ? (
            <p data-testid="access-denied">{t('accessDenied')}</p>
          ) : (
            <ul data-testid="property-list">
              {properties.map((property) => (
                <li key={property.id}>
                  {property.name} ({property.slug})
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShellPlaceholder>
  );
}
