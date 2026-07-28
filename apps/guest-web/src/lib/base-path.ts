const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const basePath =
  configuredBasePath && configuredBasePath !== '/'
    ? `/${configuredBasePath.replace(/^\/+|\/+$/g, '')}`
    : '';

export function appHref(path: string) {
  if (!path || path.startsWith('#')) return path;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!basePath || normalized === basePath || normalized.startsWith(`${basePath}/`)) {
    return normalized;
  }
  return `${basePath}${normalized}`;
}
