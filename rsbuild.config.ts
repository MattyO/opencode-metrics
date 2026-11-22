import { defineConfig } from '@rsbuild/core';
import { resolve } from 'node:path';

const src = resolve(__dirname, 'src');

export default defineConfig({
  resolve: {
    alias: {
      '@utils/': resolve(src, 'utils'),
      '@plugin/': resolve(src, 'plugin'),
      '@store/': resolve(src, 'store'),
      '@types/': resolve(src, 'types'),
      '@helpers/': resolve(src, 'helpers'),

    },
  },
});
