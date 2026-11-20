import { defineConfig } from '@rsbuild/core';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@testHelpers': resolve(__dirname, 'test/helpers'),
    },
  },
});
