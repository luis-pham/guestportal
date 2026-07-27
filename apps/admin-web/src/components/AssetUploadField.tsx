'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '../lib/api';

type Purpose = 'branding_logo' | 'branding_cover';

type PresignResponse = {
  assetId: string;
  method: 'PUT';
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
  publicUrl: string;
};

type CompleteResponse = {
  asset: {
    id: string;
    publicUrl: string;
    status: string;
  };
};

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export function AssetUploadField(props: {
  purpose: Purpose;
  propertyId: string;
  assetId: string | null;
  onUploaded: (assetId: string, publicUrl: string) => void;
  testId: string;
}) {
  const t = useTranslations('branding');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setProgress(0);

    if (!ALLOWED.includes(file.type)) {
      setError(t('uploadMimeError'));
      setProgress(null);
      return;
    }

    const maxBytes = props.purpose === 'branding_logo' ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(t('uploadSizeError'));
      setProgress(null);
      return;
    }

    const presign = await apiFetch<PresignResponse>('/v1/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({
        purpose: props.purpose,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        propertyId: props.propertyId,
      }),
    });

    if (!presign.ok) {
      setError(t('uploadPresignError'));
      setProgress(null);
      return;
    }

    setProgress(30);

    try {
      const upload = await fetch(presign.data.uploadUrl, {
        method: 'PUT',
        headers: presign.data.requiredHeaders,
        body: file,
      });
      if (!upload.ok) {
        setError(t('uploadPutError'));
        setProgress(null);
        return;
      }
    } catch {
      setError(t('uploadPutError'));
      setProgress(null);
      return;
    }

    setProgress(70);

    const complete = await apiFetch<CompleteResponse>('/v1/uploads/complete', {
      method: 'POST',
      body: JSON.stringify({ assetId: presign.data.assetId }),
    });

    if (!complete.ok) {
      setError(t('uploadCompleteError'));
      setProgress(null);
      return;
    }

    setProgress(100);
    setPreviewUrl(complete.data.asset.publicUrl);
    props.onUploaded(complete.data.asset.id, complete.data.asset.publicUrl);
  }

  return (
    <div data-testid={props.testId} style={{ display: 'grid', gap: 8 }}>
      <label style={{ fontWeight: 600 }}>
        {props.purpose === 'branding_logo' ? t('logoUpload') : t('coverUpload')}
      </label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        data-testid={`${props.testId}-input`}
        onChange={(e) => void onFileChange(e)}
      />
      {props.assetId ? (
        <p data-testid={`${props.testId}-asset-id`} style={{ fontSize: 12, opacity: 0.8 }}>
          {t('assetId')}: {props.assetId}
        </p>
      ) : null}
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          data-testid={`${props.testId}-preview`}
          style={{ maxWidth: 160, maxHeight: 80, objectFit: 'contain' }}
        />
      ) : null}
      {progress !== null && progress < 100 ? (
        <p data-testid={`${props.testId}-progress`}>
          {t('uploadProgress')}: {progress}%
        </p>
      ) : null}
      {progress === 100 ? (
        <p data-testid={`${props.testId}-done`}>{t('uploadDone')}</p>
      ) : null}
      {error ? (
        <p data-testid={`${props.testId}-error`} style={{ color: 'var(--gp-color-danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
