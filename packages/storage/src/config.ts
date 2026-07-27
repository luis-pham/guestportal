export type R2StorageConfig = {
  accountId: string | undefined;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
};

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Resolve Cloudflare R2 config from R2_* (preferred) or mapped S3_* vars.
 * Throws a clear error when required values are missing — never embeds secrets.
 */
export function loadR2Config(source: NodeJS.ProcessEnv = process.env): R2StorageConfig {
  const accountId = nonEmpty(source.R2_ACCOUNT_ID);
  const accessKeyId = nonEmpty(source.R2_ACCESS_KEY_ID) ?? nonEmpty(source.S3_ACCESS_KEY_ID);
  const secretAccessKey =
    nonEmpty(source.R2_SECRET_ACCESS_KEY) ?? nonEmpty(source.S3_SECRET_ACCESS_KEY);
  const bucket = nonEmpty(source.R2_BUCKET_NAME) ?? nonEmpty(source.S3_BUCKET);
  const publicBaseUrl =
    nonEmpty(source.R2_PUBLIC_BASE_URL) ?? nonEmpty(source.ASSETS_PUBLIC_BASE_URL);
  const endpoint =
    nonEmpty(source.S3_ENDPOINT) ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const region = nonEmpty(source.S3_REGION) ?? 'auto';
  const forcePathStyleRaw = nonEmpty(source.S3_FORCE_PATH_STYLE) ?? 'false';
  const forcePathStyle = forcePathStyleRaw === 'true' || forcePathStyleRaw === '1';

  const missing: string[] = [];
  if (!endpoint) missing.push('S3_ENDPOINT or R2_ACCOUNT_ID');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID or S3_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY or S3_SECRET_ACCESS_KEY');
  if (!bucket) missing.push('R2_BUCKET_NAME or S3_BUCKET');
  if (!publicBaseUrl) missing.push('R2_PUBLIC_BASE_URL or ASSETS_PUBLIC_BASE_URL');

  if (missing.length > 0) {
    throw new Error(
      `Invalid R2 storage configuration. Missing: ${missing.join(', ')}. ` +
        'Cloudflare R2 is required; set staging credentials in .env.',
    );
  }

  return {
    accountId,
    endpoint: endpoint!,
    region,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
    publicBaseUrl: publicBaseUrl!.replace(/\/+$/, ''),
    forcePathStyle,
  };
}
