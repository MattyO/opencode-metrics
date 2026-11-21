import { defineConfig } from '@rstest/core';
import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import path from 'node:path';
import fs from 'node:fs';

function autoMockMapper(mocksRoot: string, prefix: string): Record<string, string> {
  const m: Record<string, string> = {};
  if (!fs.existsSync(mocksRoot)) return m;

  function walk(dir: string, rel = '') {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(path.join(dir, e.name), r);
      } else if (/\.m?js$/.test(e.name)) {
        m[`^${prefix}/${r}$`] = `<rootDir>/${mocksRoot.replace(/\\/g, '/')}/${r}`;
      }
    }
  }

  walk(mocksRoot);
  return m;
}

export default defineConfig({
  testEnvironment: 'node',
  include: ['test/**/*.test.ts'],
  extends: withRsbuildConfig(),
  moduleNameMapper: {
    '\\.(css|scss)$': '<rootDir>/test/__mocks__/styleMock.ts',
    ...autoMockMapper('test/__mocks__', 'src'),
  },
  coverage: {
    provider: 'v8',
    reporters: ['text', 'lcov'],
    include: ['src/**/*.ts'],
  },
});
