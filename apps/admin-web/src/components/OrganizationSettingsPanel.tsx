'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Select } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  defaultLocale: 'vi' | 'en';
};

type SecuritySettings = {
  sessionCookie: string;
  tenantIsolation: string;
  passwordPolicy: string;
  lastOwnerProtection: boolean;
};

export function OrganizationSettingsPanel({ organizationId }: { organizationId: string }) {
  const t = useTranslations('organizationSettings');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [name, setName] = useState('');
  const [defaultLocale, setDefaultLocale] = useState<'vi' | 'en'>('vi');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    void (async () => {
      const result = await apiFetch<{ organization: Organization }>(
        `/v1/organizations/${organizationId}`,
      );
      if (!result.ok) {
        setError(t('loadError'));
        return;
      }
      setOrganization(result.data.organization);
      setName(result.data.organization.name);
      setDefaultLocale(result.data.organization.defaultLocale);
    })();
  }, [organizationId, t]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError(t('nameRequired'));
      return;
    }
    const result = await apiFetch<{ organization: Organization }>(
      `/v1/organizations/${organizationId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), defaultLocale }),
      },
    );
    if (!result.ok) {
      setError(result.status === 403 ? t('permissionError') : t('saveError'));
      return;
    }
    setOrganization(result.data.organization);
    setSaved(true);
  }

  if (!organization && !error) return <main className="gp-state">{t('loading')}</main>;

  return (
    <form className="gp-state" data-testid="organization-settings-panel" onSubmit={(event) => void save(event)}>
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>
      <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <Input
          label={t('name')}
          data-testid="organization-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Input
          label={t('slug')}
          data-testid="organization-slug"
          value={organization?.slug ?? ''}
          readOnly
        />
        <Select
          label={t('defaultLocale')}
          data-testid="organization-default-locale"
          value={defaultLocale}
          onChange={(event) => setDefaultLocale(event.target.value as 'vi' | 'en')}
          options={[
            { value: 'vi', label: 'Tiếng Việt' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      {error ? (
        <p data-testid="organization-settings-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p data-testid="organization-settings-saved">{t('saved')}</p> : null}
      <div style={{ marginTop: 16 }}>
        <Button data-testid="organization-settings-submit" type="submit">
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

export function SecuritySettingsPanel({ organizationId }: { organizationId: string }) {
  const t = useTranslations('securitySettings');
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    void (async () => {
      const result = await apiFetch<{ settings: SecuritySettings }>(
        `/v1/organizations/${organizationId}/security-settings`,
      );
      if (!result.ok) {
        setError(result.status === 403 ? t('permissionError') : t('loadError'));
        return;
      }
      setSettings(result.data.settings);
    })();
  }, [organizationId, t]);

  return (
    <main className="gp-state" data-testid="security-settings-panel">
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>
      {error ? (
        <p data-testid="security-settings-error" role="alert">
          {error}
        </p>
      ) : null}
      {settings ? (
        <dl className="gp-stack" data-testid="security-settings-list">
          <div>
            <dt>{t('sessionCookie')}</dt>
            <dd>{settings.sessionCookie}</dd>
          </div>
          <div>
            <dt>{t('tenantIsolation')}</dt>
            <dd>{settings.tenantIsolation}</dd>
          </div>
          <div>
            <dt>{t('passwordPolicy')}</dt>
            <dd>{settings.passwordPolicy}</dd>
          </div>
          <div>
            <dt>{t('lastOwnerProtection')}</dt>
            <dd>{settings.lastOwnerProtection ? t('enabled') : t('disabled')}</dd>
          </div>
        </dl>
      ) : null}
    </main>
  );
}
