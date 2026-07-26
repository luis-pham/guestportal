/**
 * Foundation descriptors for local Docker / Testcontainers usage.
 * Containers are started by docker-compose in Phase 00 and by Testcontainers
 * in later integration suites.
 */
export type LocalInfraService = {
  name: string;
  image: string;
  hostPort: number;
  healthcheck: string;
};

export const LOCAL_INFRA = {
  postgres: {
    name: 'postgres',
    image: 'pgvector/pgvector:pg16',
    hostPort: 5432,
    healthcheck: 'pg_isready -U guestportal -d guestportal',
  },
  redis: {
    name: 'redis',
    image: 'redis:7.4-alpine',
    hostPort: 6379,
    healthcheck: 'redis-cli ping',
  },
  minio: {
    name: 'minio',
    image: 'minio/minio:RELEASE.2025-04-22T22-12-26Z',
    hostPort: 9000,
    healthcheck: 'curl -f http://localhost:9000/minio/health/live',
  },
} as const satisfies Record<string, LocalInfraService>;

export function describeLocalInfra(): LocalInfraService[] {
  return Object.values(LOCAL_INFRA);
}
