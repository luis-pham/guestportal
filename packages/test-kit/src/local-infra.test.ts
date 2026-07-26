import { describe, expect, it } from 'vitest';
import { LOCAL_INFRA, describeLocalInfra } from './local-infra.js';

describe('local infra foundation', () => {
  it('defines postgres, redis and object storage', () => {
    const names = describeLocalInfra().map((service) => service.name);
    expect(names).toEqual(expect.arrayContaining(['postgres', 'redis', 'minio']));
    expect(LOCAL_INFRA.postgres.image).toContain('pgvector');
  });
});
