import { defineConfig } from '@rsbuild/core';
import { resolve } from 'node:path';

const src = resolve(__dirname, 'src');

export default defineConfig({
  dev: {
    writeToDisk: true,
  },
  resolve: {
    alias: {
      '@utils/': resolve(src, 'utils'),
      '@plugin/': resolve(src, 'plugin'),
      '@store/': resolve(src, 'store'),
      '@types/': resolve(src, 'types'),
      '@helpers/': resolve(src, 'helpers'),
    },
  },
  output: {
    target: 'node',
    distPath: {
      root: 'dist',
    },
    filename: {
      js: '[name].mjs',
    },
    externalHelpers: false,
    polyfill: 'off',
  },
  source: {
    entry: {
      index: './src/index.ts',
    },
    // Allow importing .ts files directly
    tsconfigPath: './tsconfig.json',
  },
  html: {
    contentStrategy: 'static',
  },
});
