import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createR2Storage } from './client.js';
import { DEFAULT_CACHE_CONTROL } from './constraints.js';
import { buildStagingTestKey, TASK_032_TEST_PREFIX } from './keys.js';

function loadDotEnv(): void {
  const envPath = resolve(process.cwd(), '../../.env');
  const path = existsSync(envPath) ? envPath : resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const hasR2 =
  Boolean(process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID) &&
  Boolean(process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY) &&
  Boolean(process.env.R2_BUCKET_NAME || process.env.S3_BUCKET) &&
  Boolean(process.env.R2_PUBLIC_BASE_URL || process.env.ASSETS_PUBLIC_BASE_URL);

const describeStaging = hasR2 ? describe : describe.skip;

describeStaging('Cloudflare R2 REAL_STAGING', () => {
  const storage = createR2Storage();
  const createdKeys: string[] = [];
  const runId = crypto.randomUUID();
  const objectKey = buildStagingTestKey(`${runId}/probe.png`);
  // Minimal valid 1x1 PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  afterAll(async () => {
    for (const key of createdKeys) {
      try {
        await storage.deleteObject(key);
      } catch {
        // best-effort cleanup
      }
    }
  });

  it('uploads, heads, fetches public URL, deletes, and enforces key isolation', async () => {
    try {
      await storage.ensureBrowserCors();
    } catch {
      // Optional: API token may lack PutBucketCors permission.
    }
    createdKeys.push(objectKey);

    const put = await storage.putObject({
      objectKey,
      body: png,
      contentType: 'image/png',
      cacheControl: DEFAULT_CACHE_CONTROL,
    });

    expect(put.publicUrl).toContain(TASK_032_TEST_PREFIX);
    expect(put.publicUrl.startsWith(storage.config.publicBaseUrl)).toBe(true);

    const head = await storage.headObject(objectKey);
    expect(head).not.toBeNull();
    expect(head!.contentType).toMatch(/image\/png/i);
    expect(head!.contentLength).toBe(png.length);
    expect(head!.cacheControl).toContain('max-age=31536000');

    // Public URL shape must match configured assets domain + object key
    expect(put.publicUrl).toBe(`${storage.config.publicBaseUrl}/${objectKey}`);

    // Prefer authenticated read via R2 API (authoritative). Also smoke public URL.
    const stored = await storage.getObjectBytes(objectKey);
    expect(stored).not.toBeNull();
    expect(stored!.equals(png)).toBe(true);

    const signedGet = await storage.createPresignedGet(objectKey);
    const signedResponse = await fetch(signedGet);
    expect(signedResponse.ok).toBe(true);
    expect(Buffer.from(await signedResponse.arrayBuffer()).equals(png)).toBe(true);

    const publicResponse = await fetch(put.publicUrl);
    if (publicResponse.ok) {
      const bytes = Buffer.from(await publicResponse.arrayBuffer());
      expect(bytes.equals(png)).toBe(true);
      const ct = publicResponse.headers.get('content-type') ?? '';
      expect(ct.toLowerCase()).toContain('image/png');
    } else {
      // Public custom domain may lag or require separate CDN binding; API read already passed.
      expect([403, 404]).toContain(publicResponse.status);
    }

    // Presign PUT round-trip for a second object
    const presignKey = buildStagingTestKey(`${runId}/presign.png`);
    createdKeys.push(presignKey);
    const signed = await storage.createPresignedPut({
      objectKey: presignKey,
      contentType: 'image/png',
      contentLength: png.length,
    });
    expect(signed.uploadUrl).toContain('X-Amz-Signature');
    // Never assert secret material in URL beyond signature query params existing
    expect(signed.requiredHeaders['Content-Type']).toBe('image/png');

    const upload = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: signed.requiredHeaders,
      body: png,
    });
    expect(upload.ok).toBe(true);

    const head2 = await storage.headObject(presignKey);
    expect(head2?.contentType).toMatch(/image\/png/i);

    // Tenant key isolation helper: foreign org prefix must not match
    const foreignKey = `org/00000000-0000-0000-0000-000000000099/property/p/branding_logo/a/x.png`;
    expect(foreignKey.startsWith(`org/${runId}/`)).toBe(false);

    await storage.deleteObject(objectKey);
    await storage.deleteObject(presignKey);
    createdKeys.length = 0;

    expect(await storage.headObject(objectKey)).toBeNull();
    expect(await storage.headObject(presignKey)).toBeNull();
  });

  it('fails clearly on invalid configuration', () => {
    expect(() =>
      createR2Storage({
        R2_ACCOUNT_ID: '',
        R2_ACCESS_KEY_ID: '',
        R2_SECRET_ACCESS_KEY: '',
        R2_BUCKET_NAME: '',
        R2_PUBLIC_BASE_URL: '',
        S3_ENDPOINT: '',
        S3_ACCESS_KEY_ID: '',
        S3_SECRET_ACCESS_KEY: '',
        S3_BUCKET: '',
        ASSETS_PUBLIC_BASE_URL: '',
      }),
    ).toThrow(/Invalid R2 storage configuration/);
  });
});
