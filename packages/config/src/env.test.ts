import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const validEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://guestportal@localhost:5432/guestportal',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'guestportal',
  S3_SECRET_ACCESS_KEY: 'guestportal_secret',
  S3_BUCKET: 'guest-platform-dev',
  ASSETS_PUBLIC_BASE_URL: 'http://localhost:9000/guest-platform-dev',
  AUTH_URL: 'http://localhost:54321',
  AUTH_ANON_KEY: 'anon-key',
  AUTH_SERVICE_ROLE_KEY: 'service-role-key',
  AUTH_COOKIE_SECRET: 'abcdefghijklmnopqrstuvwxyz012345',
} as NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('parses valid environment values', () => {
    const env = loadEnv(validEnv);
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.EMBEDDING_DIMENSIONS).toBe(768);
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
  });

  it('rejects short auth cookie secrets', () => {
    expect(() =>
      loadEnv({
        ...validEnv,
        AUTH_COOKIE_SECRET: 'too-short',
      }),
    ).toThrow(/AUTH_COOKIE_SECRET/);
  });

  it('allows missing Gemini API key in local environments', () => {
    const env = loadEnv({
      ...validEnv,
      GEMINI_API_KEY: '',
    });
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });
});
