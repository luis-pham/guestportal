import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.staging.test.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
  },
});
