'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Input, Select } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

type Property = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  defaultLocale: string;
  supportedLocales: string[];
  status: string;
};

function propertyIdFromPath(pathname: string) {
  const match = pathname.match(/\/properties\/([^/]+)\//);
  return match?.[1] ?? '';
}

export function PropertySettingsForm() {
  const t = useTranslations('property');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const me = await apiFetch('/v1/me');
      if (!me.ok) {
        router.replace(`/${locale}/login`);
        return;
      }
      const result = await apiFetch<{ property: Property }>(`/v1/properties/${propertyId}`);
      if (!result.ok) {
        setError(t('loadError'));
        return;
      }
      setProperty(result.data.property);
    })();
  }, [locale, propertyId, router, t]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const timezone = String(data.get('timezone') ?? '').trim();
    const currency = String(data.get('currency') ?? '')
      .trim()
      .toUpperCase();
    const defaultLocale = String(data.get('defaultLocale') ?? '').trim();
    const supportedLocales = String(data.get('supportedLocales') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const status = String(data.get('status') ?? 'active');

    if (supportedLocales.length === 0) {
      setError(t('localesRequired'));
      return;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      setError(t('currencyInvalid'));
      return;
    }

    const result = await apiFetch<{ property: Property }>(`/v1/properties/${propertyId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name,
        timezone,
        currency,
        defaultLocale,
        supportedLocales,
        status,
      }),
    });
    if (!result.ok) {
      setError(t('saveError'));
      return;
    }
    setProperty(result.data.property);
    setSaved(true);
  }

  if (!property && !error) {
    return <main className="gp-state">{t('loading')}</main>;
  }

  if (!property) {
    return (
      <main className="gp-state" data-testid="property-settings-error">
        {error}
      </main>
    );
  }

  return (
    <form className="gp-state" data-testid="property-settings-form" onSubmit={(e) => void onSubmit(e)}>
      <h2 className="gp-state__title">{t('settingsTitle')}</h2>
      <p className="gp-state__body">{t('settingsBody')}</p>
      <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        <Input label={t('name')} name="name" data-testid="property-name" defaultValue={property.name} required />
        <Input
          label={t('timezone')}
          name="timezone"
          data-testid="property-timezone"
          defaultValue={property.timezone}
          required
        />
        <Input
          label={t('currency')}
          name="currency"
          data-testid="property-currency"
          defaultValue={property.currency}
          required
        />
        <Input
          label={t('defaultLocale')}
          name="defaultLocale"
          data-testid="property-default-locale"
          defaultValue={property.defaultLocale}
          required
        />
        <Input
          label={t('supportedLocales')}
          name="supportedLocales"
          data-testid="property-supported-locales"
          defaultValue={property.supportedLocales.join(',')}
        />
        <Select
          label={t('status')}
          name="status"
          data-testid="property-status"
          defaultValue={property.status}
          options={[
            { value: 'active', label: t('statusActive') },
            { value: 'suspended', label: t('statusSuspended') },
          ]}
        />
      </div>
      {error ? (
        <p data-testid="property-settings-error" style={{ color: 'var(--gp-color-danger)' }}>
          {error}
        </p>
      ) : null}
      {saved ? <p data-testid="property-settings-saved">{t('saved')}</p> : null}
      <div style={{ marginTop: 16 }}>
        <button data-testid="property-settings-submit" type="submit" className="gp-btn gp-btn--primary">
          {t('save')}
        </button>
      </div>
    </form>
  );
}
