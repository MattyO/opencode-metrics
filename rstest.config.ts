import { defineConfig } from '@rstest/core';
import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Auto-generate resolve.alias entries from mock files in a directory.
 *
 * Naming convention for mock files:
 *   @scope/name  →  @scope_name.ts       (scoped: @ prefix, _ replaces /)
 *   name         →  name.ts              (regular: name as-is)
 *
 * The leading @ in the filename is just a marker — it signals "this is a scoped package"
 * so the mapper knows to reconstruct @scope/name from @scope_name.
 */
function autoMockMapper(mocksRoot: string): Record<string, string> {
  const m: Record<string, string> = {};
  if (!fs.existsSync(mocksRoot)) return m;

  function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(fullPath);
      } else {
        const extLen = path.extname(e.name).length;
        const base = e.name.slice(0, e.name.length - extLen); // filename without extension
        let importPath: string;
        if (base.startsWith('@')) {
          // Scoped package: @scope_name.ts → @scope/name
          const scoped = base.slice(1); // scope_name
          const parts = scoped.split('_');
          importPath = `@${parts[0]}/${parts.slice(1).join('_')}`;
        } else {
          // Regular package: name.ts → name
          importPath = base;
        }
        m[importPath] = path.resolve(fullPath).replace(/\\/g, '/');
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
  resolve: {
    alias: {
      ...autoMockMapper('test/__mocks__'),
    },
  },
  coverage: {
    provider: 'v8',
    reporters: ['text', 'lcov'],
    include: ['src/**/*.ts'],
  },
});
