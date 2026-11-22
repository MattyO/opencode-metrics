import { defineConfig } from '@rstest/core';
import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import { autoMockMapper } from './test/helpers/mocks';
import { resolve } from 'node:path';

export default defineConfig({
  testEnvironment: 'node',
  include: ['test/**/*.test.ts'],
  extends: withRsbuildConfig(),
  resolve: {
    alias: {
      // auto-mock overrides — these take priority over rsbuild's
      ...autoMockMapper('test/__mocks__'),
      // test helpers and mock factories
      '@testHelpers': resolve(__dirname, 'test/helpers'),
      '@mock-factories': resolve(__dirname, 'test/mock-factories'),
    },
  },
  coverage: {
    provider: 'v8',
    reporters: ['text', 'lcov'],
    include: ['src/**/*.ts'],
  },
});
