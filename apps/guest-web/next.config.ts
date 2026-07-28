import type { NextConfig } from 'next';
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH);

function normalizeBasePath(value: string | undefined) {
  if (!value || value === '/') return undefined;
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.replace(/\/+$/, '');
}

const nextConfig: NextConfig = {
  transpilePackages: ['@guestportal/ui', '@guestportal/contracts'],
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
