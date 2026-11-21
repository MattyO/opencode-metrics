import path from 'node:path'
import fs from 'node:fs'

/**
 * Auto-generate module aliases from mock files in a directory.
 *
 * Naming convention for mock files:
 *   @scope/name  →  @scope_name.ts       (scoped: @ prefix, _ replaces /)
 *   name         →  name.ts              (regular: name as-is)
 *
 * The leading @ in the filename is just a marker — it signals "this is a scoped package"
 * so the mapper knows to reconstruct @scope/name from @scope_name.
 *
 * @param mocksRoot - Directory to scan for mock files
 * @returns Map of import paths to resolved file paths
 */
export function autoMockMapper(mocksRoot: string): Record<string, string> {
  const m: Record<string, string> = {}
  if (!fs.existsSync(mocksRoot)) return m

  function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, e.name)
      if (e.isDirectory()) {
        walk(fullPath)
      } else {
        const extLen = path.extname(e.name).length
        const base = e.name.slice(0, e.name.length - extLen)
        let importPath: string
        if (base.startsWith('@')) {
          const scoped = base.slice(1)
          const parts = scoped.split('_')
          importPath = `@${parts[0]}/${parts.slice(1).join('_')}`
        } else {
          importPath = base
        }
        m[importPath] = path.resolve(fullPath).replace(/\\/g, '/')
      }
    }
  }

  walk(mocksRoot)
  return m
}
