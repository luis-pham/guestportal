import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH);

function normalizeBasePath(value: string | undefined) {
  if (!value || value === '/') return undefined;
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.replace(/\/+$/, '');
}

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  transpilePackages: ['@guestportal/ui'],
};

export default withNextIntl(nextConfig);
