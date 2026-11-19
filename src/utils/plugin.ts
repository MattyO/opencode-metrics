import * as fs from 'node:fs'

const DEBUG_LOG = '/tmp/opencode-tracing-debug.log'

export function debug(...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ')}\n`
  fs.appendFileSync(DEBUG_LOG, line)
}

export interface EventListenerOptions {
  onEvent: (event: { type: string; data: Record<string, unknown> }) => void | Promise<void>
  onError: (err: unknown) => void
  types: string[]
  ctx: { event: { subscribe: (args: { types?: string[]; signal?: AbortSignal }) => AsyncIterable<{ type: string; data: Record<string, unknown> }> } }
}

export function eventListener(options: EventListenerOptions): AbortController {
  const controller = new AbortController()
  void (async () => {
    try {
      for await (
        const event of options.ctx.event.subscribe({ types: options.types, signal: controller.signal })
      ) {
        await options.onEvent(event)
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        options.onError(err)
      }
    }
  })()
  return controller
}
