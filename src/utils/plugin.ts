import * as fs from 'node:fs'

import { logError } from '@utils/log'

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

export interface EventListenerPairOptions {
  startEvent: (event: { type: string; data: Record<string, unknown> }) => void | Promise<void>
  endEvent: (event: { type: string; data: Record<string, unknown> }) => void | Promise<void>
  onError: (err: unknown) => void
  startTypes: string[]
  endTypes: string[]
  ctx: { event: { subscribe: (args: { types?: string[]; signal?: AbortSignal }) => AsyncIterable<{ type: string; data: Record<string, unknown> }> } }
}

export function eventListener(options: EventListenerOptions): AbortController {
  const controller = new AbortController()

  const blacklistedEvents = new Set(
    options.types.filter((t) => t.startsWith('-')).map((t) => t.slice(1)),
  )

  const useWildcard = options.types.includes('*')
  const subscribeTypes = useWildcard
    ? undefined
    : options.types.filter((t) => !t.startsWith('-') && !blacklistedEvents.has(t))

  void (async () => {
    try {
      for await (const event of options.ctx.event.subscribe({
        ...(useWildcard ? {} : { types: subscribeTypes }),
        signal: controller.signal,
      })) {

        if (blacklistedEvents.has(event.type)) continue
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

export function eventListenerPair(options: EventListenerPairOptions): AbortController[] {
  const { startTypes, endTypes, startEvent, endEvent, onError, ctx } = options

  return [
    eventListener({
      types: startTypes,
      ctx,
      onEvent: startEvent,
      onError,
    }),
    eventListener({
      types: endTypes,
      ctx,
      onEvent: endEvent,
      onError,
    }),
  ]
}

export function defaultErrorEvent(err: unknown): void {
  if ((err as Error)?.name !== 'AbortError') {
    logError('Error in event listener', err)
  }
}
