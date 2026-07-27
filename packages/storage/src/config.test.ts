import { describe, expect, it } from 'vitest';
import { loadR2Config } from './config.js';

describe('loadR2Config', () => {
  it('loads from R2_* variables', () => {
    const config = loadR2Config({
      R2_ACCOUNT_ID: 'abc123accountid000000000000000000',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET_NAME: 'assets',
      R2_PUBLIC_BASE_URL: 'https://assets.example.test/',
    });
    expect(config.endpoint).toBe(
      'https://abc123accountid000000000000000000.r2.cloudflarestorage.com',
    );
    expect(config.bucket).toBe('assets');
    expect(config.publicBaseUrl).toBe('https://assets.example.test');
    expect(config.forcePathStyle).toBe(false);
  });

  it('fails clearly when credentials are missing', () => {
    expect(() => loadR2Config({})).toThrow(/Missing:.*R2_ACCESS_KEY_ID/);
  });

  it('accepts mapped S3_* variables', () => {
    const config = loadR2Config({
      S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      S3_ACCESS_KEY_ID: 'ak',
      S3_SECRET_ACCESS_KEY: 'sk',
      S3_BUCKET: 'bucket',
      ASSETS_PUBLIC_BASE_URL: 'https://cdn.example.test',
      S3_FORCE_PATH_STYLE: 'false',
    });
    expect(config.endpoint).toContain('r2.cloudflarestorage.com');
    expect(config.bucket).toBe('bucket');
  });
});
