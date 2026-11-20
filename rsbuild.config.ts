import { defineConfig } from '@rsbuild/core';
import { resolve } from 'node:path';

const mocks = resolve(__dirname, 'src/__mocks__');

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@testHelpers': resolve(__dirname, 'test/helpers'),
      '@opentelemetry/api': resolve(mocks, 'opentelemetry-api-mock.ts'),
      '@opencode/plugin': resolve(mocks, 'opencode-plugin-mock.ts'),
    },
  },
});
