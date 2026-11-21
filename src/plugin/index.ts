import { Plugin } from '@opencode/plugin'
import { trace, Span } from '@opentelemetry/api'
import { find, filter, flatten } from 'lodash'
import { inspect } from 'util'

// Minimal context type — @opencode/plugin provides the real one at runtime
interface EventData {
  sessionID?: string
  assistantMessageID?: string
  inboxID?: string
  agent?: string
  model?: { id?: string }
}

interface PluginContext {
  options: unknown
  event: { subscribe: (args: { types?: string[]; signal?: AbortSignal }) => AsyncIterable<{ type: string; data: EventData }> }
}

import { TracingOptions, ExecutionInfo } from '@/types/tracing'
import { logError } from '@/utils/log'
import { debug, eventListener, eventListenerPair } from '@/utils/plugin'
import { sharedEvents } from '@/plugin/eventDefinitions'
import { setupProvider } from '@/utils/tracing'
import { spanStore } from '@/store/spanStore'

import { pairDefinitions } from '@/plugin/eventPairDefinitions'
import { pluginEvents } from '@/plugin/eventDefinitions'


// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default Plugin.define({
  id: 'opencode-tracing',

  async setup(ctx: PluginContext) {
    const opts: TracingOptions = {
      enabled: true,
      sampleRate: 1,
      ...(ctx.options as Partial<TracingOptions>),
    }
    if (!opts.enabled) {
      debug('[opencode-tracing] Tracing disabled via options')
      return
    }

    const endpoint = opts.endpoint
    const serviceName = opts.serviceName ?? 'opencode-tracing'

    debug(`[opencode-tracing] ENDPOINT = ${endpoint}`)

    setupProvider(endpoint, serviceName, opts, true)


    /** Clean up stale session data periodically */
    const cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, ts] of seenEvents) {
        if (now - ts > SESSION_EXPIRY_MS) seenEvents.delete(key)
      }
    }, 60_000)

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------


    const controllers: AbortController[] = flatten([
      // session.execution.started

      pairDefinitions.enteries.map((key, pairDefinition) => {
        return eventListenerPair({
          ctx,
          onError: sharedEvents.defaultErrorEvent,
          startTypes: pairDefinition.startTypes,
          startEvent: pairDefinition.startEvent,
          endTypes: pairDefinition.endTypes,
          endEvent: pairDefinition.endEvent,
        })

      }),

      pluginEvents.enteries.map((key, eventDefinition) => {
        return eventListenerPair({
          ctx,
          onError: sharedEvents.defaultErrorEvent,
          types: eventDefinition.types,
          onEvent: eventDefinition.event,
        })

      }),
    ])

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return async () => {
      debug('[opencode-tracing] Shutdown — flushing spans...')
      controllers.forEach((c) => c.abort())
      clearInterval(cleanupTimer)
      await spanStore.getState().shutdownProvider()
    }
  },
})
