import { debug } from './plugin'

export function logError(label: string, err: unknown): void {
  const e = err as Error
  const detail = e?.stack || e?.message || e?.name || String(err)
  debug(`[opencode-tracing] ${label}: ${detail}`)
}
