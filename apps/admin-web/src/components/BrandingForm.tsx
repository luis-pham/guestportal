'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import type { PropertyBranding } from '@guestportal/contracts';
import { Input, Select } from '@guestportal/ui';
import { apiFetch } from '../lib/api';
import { AssetUploadField } from './AssetUploadField';

const hexOk = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);

function propertyIdFromPath(pathname: string) {
  const match = pathname.match(/\/properties\/([^/]+)\//);
  return match?.[1] ?? '';
}

export function BrandingForm() {
  const t = useTranslations('branding');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const [form, setForm] = useState<PropertyBranding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const me = await apiFetch('/v1/me');
      if (!me.ok) {
        router.replace(`/${locale}/login`);
        return;
      }
      const result = await apiFetch<{ branding: PropertyBranding }>(
        `/v1/properties/${propertyId}/branding`,
      );
      if (!result.ok) {
        setError(t('loadError'));
        return;
      }
      setForm(result.data.branding);
    })();
  }, [locale, propertyId, router, t]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setError(null);
    setSaved(false);
    const data = new FormData(event.currentTarget);
    const next: PropertyBranding = {
      displayName: String(data.get('displayName') ?? '').trim(),
      primaryColor: String(data.get('primaryColor') ?? '').trim(),
      primaryHoverColor: String(data.get('primaryHoverColor') ?? '').trim(),
      accentColor: String(data.get('accentColor') ?? '').trim() || null,
      backgroundColor: String(data.get('backgroundColor') ?? '').trim(),
      textColor: String(data.get('textColor') ?? '').trim(),
      logoAssetId: form.logoAssetId,
      coverAssetId: form.coverAssetId,
      fontFamily: String(data.get('fontFamily') ?? 'sans') as PropertyBranding['fontFamily'],
    };

    for (const color of [
      next.primaryColor,
      next.primaryHoverColor,
      next.backgroundColor,
      next.textColor,
      next.accentColor,
    ]) {
      if (color && !hexOk(color)) {
        setError(t('colorInvalid'));
        return;
      }
    }

    const result = await apiFetch<{ branding: PropertyBranding }>(
      `/v1/properties/${propertyId}/branding`,
      {
        method: 'PUT',
        body: JSON.stringify(next),
      },
    );
    if (!result.ok) {
      setError(t('saveError'));
      return;
    }
    setForm(result.data.branding);
    setSaved(true);
  }

  if (!form && !error) {
    return <main className="gp-state">{t('loading')}</main>;
  }

  if (!form) {
    return (
      <main className="gp-state" data-testid="branding-error">
        {error}
      </main>
    );
  }

  return (
    <form className="gp-state" data-testid="branding-form" onSubmit={(e) => void onSubmit(e)}>
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>
      <div
        data-testid="branding-preview"
        style={{
          marginBottom: 16,
          padding: 16,
          borderRadius: 12,
          background: form.backgroundColor,
          color: form.textColor,
          border: `2px solid ${form.primaryColor}`,
        }}
      >
        <strong style={{ color: form.primaryColor }}>{form.displayName}</strong>
        <div style={{ marginTop: 8, color: form.primaryHoverColor }}>{t('previewHint')}</div>
      </div>
      <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        <Input
          label={t('displayName')}
          name="displayName"
          data-testid="branding-display-name"
          defaultValue={form.displayName}
          required
        />
        <Input
          label={t('primaryColor')}
          name="primaryColor"
          data-testid="branding-primary"
          defaultValue={form.primaryColor}
          required
        />
        <Input
          label={t('primaryHoverColor')}
          name="primaryHoverColor"
          data-testid="branding-primary-hover"
          defaultValue={form.primaryHoverColor}
          required
        />
        <Input
          label={t('accentColor')}
          name="accentColor"
          data-testid="branding-accent"
          defaultValue={form.accentColor ?? ''}
        />
        <Input
          label={t('backgroundColor')}
          name="backgroundColor"
          data-testid="branding-background"
          defaultValue={form.backgroundColor}
          required
        />
        <Input
          label={t('textColor')}
          name="textColor"
          data-testid="branding-text"
          defaultValue={form.textColor}
          required
        />
        <Select
          label={t('fontFamily')}
          name="fontFamily"
          data-testid="branding-font"
          defaultValue={form.fontFamily}
          options={[
            { value: 'sans', label: 'Sans' },
            { value: 'serif', label: 'Serif' },
            { value: 'display', label: 'Display' },
            { value: 'system', label: 'System' },
          ]}
        />
        <AssetUploadField
          purpose="branding_logo"
          propertyId={propertyId}
          assetId={form.logoAssetId}
          testId="branding-logo-upload"
          onUploaded={(assetId) => setForm((prev) => (prev ? { ...prev, logoAssetId: assetId } : prev))}
        />
        <AssetUploadField
          purpose="branding_cover"
          propertyId={propertyId}
          assetId={form.coverAssetId}
          testId="branding-cover-upload"
          onUploaded={(assetId) =>
            setForm((prev) => (prev ? { ...prev, coverAssetId: assetId } : prev))
          }
        />
      </div>
      {error ? (
        <p data-testid="branding-error" style={{ color: 'var(--gp-color-danger)' }}>
          {error}
        </p>
      ) : null}
      {saved ? <p data-testid="branding-saved">{t('saved')}</p> : null}
      <div style={{ marginTop: 16 }}>
        <button data-testid="branding-submit" type="submit" className="gp-btn gp-btn--primary">
          {t('save')}
        </button>
      </div>
    </form>
  );
}
