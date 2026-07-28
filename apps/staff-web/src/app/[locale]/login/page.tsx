'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { appHref } from '../../../lib/base-path';

export default function LoginPage() {
  const t = useTranslations('login');
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState('staff.hotel@aurora.test');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await apiFetch<{ error?: { code: string } }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!result.ok) {
      setError(t('error'));
      return;
    }
    router.push(`/${locale}/inbox`);
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--gp-color-background)',
        fontFamily: 'var(--gp-font-sans)',
        padding: 'var(--gp-space-24)',
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--gp-color-surface)',
          border: '1px solid var(--gp-color-border)',
          borderRadius: 'var(--gp-radius-lg)',
          padding: 'var(--gp-space-32)',
        }}
      >
        <h1 style={{ marginTop: 0 }}>{t('title')}</h1>
        <p style={{ color: 'var(--gp-color-text-secondary)' }}>{t('subtitle')}</p>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <div>{t('email')}</div>
          <input
            data-testid="login-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={{ width: '100%', padding: 10, marginTop: 4 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <div>{t('password')}</div>
          <input
            data-testid="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            style={{ width: '100%', padding: 10, marginTop: 4 }}
          />
        </label>
        {error ? (
          <p data-testid="login-error" style={{ color: 'var(--gp-color-danger)' }}>
            {error}
          </p>
        ) : null}
        <button
          data-testid="login-submit"
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--gp-color-brand)',
            color: 'white',
            border: 0,
            borderRadius: 'var(--gp-radius-md)',
          }}
        >
          {t('submit')}
        </button>
        <div style={{ marginTop: 16 }}>
          <a href={appHref(`/${locale === 'vi' ? 'en' : 'vi'}/login`)}>
            {locale === 'vi' ? t('switchToEn') : t('switchToVi')}
          </a>
        </div>
      </form>
    </main>
  );
}
