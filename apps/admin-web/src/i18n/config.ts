export const locales = ['vi', 'en'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'vi';
export const localeCookieName = 'NEXT_LOCALE';

export function resolveLocale(input: string | null | undefined): AppLocale {
  return input === 'en' ? 'en' : 'vi';
}

export function getMessageFallback({
  namespace,
  key,
}: {
  namespace?: string;
  key: string;
  error?: Error;
}): string {
  return namespace ? `${namespace}.${key}` : key;
}
