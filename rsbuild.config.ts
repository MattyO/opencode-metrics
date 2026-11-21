import { defineConfig } from '@rsbuild/core';
import { resolve } from 'node:path';

const src = resolve(__dirname, 'src');
const helpers = resolve(__dirname, 'test/helpers');

export default defineConfig({
  resolve: {
    alias: {
      '@': src,
      '@testHelpers': helpers,
    },
  },
});
