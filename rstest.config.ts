import { defineConfig } from '@rstest/core';
import { withRsbuildConfig } from '@rstest/adapter-rsbuild';

export default defineConfig({
  testEnvironment: 'node',
  include: ['test/**/*.test.ts'],
  extends: withRsbuildConfig(),
  coverage: {
    provider: 'v8',
    reporters: ['text', 'lcov'],
    include: ['src/**/*.ts'],
  },
});
