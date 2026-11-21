import * as fs from 'node:fs'
import { inspect } from 'util'
import { DEBUG_LOG } from '@plugin/constants'

export function debug(...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${args.map((a) => (typeof a === 'object' ? inspect(a, { depth: 3, colors: false }) : String(a))).join(' ')}\n`
  fs.appendFileSync(DEBUG_LOG, line)
}

export function logError(label: string, err: unknown): void {
  const e = err as Error
  const detail = e?.stack || e?.message || e?.name || String(err)
  debug(`[opencode-tracing] ${label}: ${detail}`)
}

