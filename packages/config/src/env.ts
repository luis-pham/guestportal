import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  GUEST_WEB_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_WEB_URL: z.string().url().default('http://localhost:3101'),
  STAFF_WEB_URL: z.string().url().default('http://localhost:3002'),
  API_URL: z.string().url().default('http://localhost:4000'),
  EMBEDDING_SERVICE_URL: z.string().url().default('http://localhost:4100'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default('auto'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .default(true),
  ASSETS_PUBLIC_BASE_URL: z.string().url(),

  AUTH_PROVIDER: z.enum(['supabase', 'oidc']).default('supabase'),
  AUTH_URL: z.string().url(),
  AUTH_ANON_KEY: z.string().min(1),
  AUTH_SERVICE_ROLE_KEY: z.string().min(1),
  AUTH_COOKIE_SECRET: z.string().min(32),

  GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  GEMINI_LIVE_MODEL: z.string().min(1).default('gemini-2.5-flash-preview-native-audio-dialog'),

  EMBEDDING_MODEL: z.string().min(1).default('embeddinggemma-300m'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
