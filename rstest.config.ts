import { defineConfig } from '@rstest/core';
import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import { autoMockMapper } from './test/helpers/mocks';

export default defineConfig({
  testEnvironment: 'node',
  include: ['test/**/*.test.ts'],
  extends: withRsbuildConfig(),
  resolve: {
    alias: autoMockMapper('test/__mocks__'),
  },
  coverage: {
    provider: 'v8',
    reporters: ['text', 'lcov'],
    include: ['src/**/*.ts'],
  },
});
