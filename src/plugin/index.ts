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
import { logError } from '@/utils/logger'
import { debug, defaultErrorEvent, eventListener, eventListenerPair } from '@/utils/plugin'
import { resolveOtlpEndpoint } from '@/utils/otel'
import { setupProvider } from '@/utils/tracing'
import { useSpanStore } from '@/store/spanStore'


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

    const endpoint = resolveOtlpEndpoint(opts)
    const serviceName = opts.serviceName ?? 'opencode-tracing'

    debug(`[opencode-tracing] ENDPOINT = ${endpoint}`)

    setupProvider(endpoint, serviceName, opts, true)

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    //const executions = new Map<string, ExecutionInfo>()
    //const seenEvents = new Map<string, number>() // dedup: "type:sessionID:eventKey" → timestamp
    const SESSION_EXPIRY_MS = 300_000 // 5 min — clean up old sessions

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

    const ALL_EVENTS = [
      'session.execution.started',
      'session.execution.succeeded',
      'session.execution.failed',
      'session.execution.interrupted',
      'session.inbox.delivered',
      'session.step.started',
      'session.step.ended',
      'session.step.first-token',
      'session.reasoning.started',
      'session.reasoning.ended',
      'session.tool.called',
      'session.tool.success',
      'session.tool.failed',
      'session.compaction.started',
      'session.compaction.ended',
    ] as const
    const SHOW_FULL_DATA= new Set([
      'session.reasoning.started',
      'session.reasoning.ended',
      'session.tool.called',
      'session.tool.success',
      'session.tool.failed',
      'session.compaction.started',
      'session.compaction.ended',
    ])

    const controllers: AbortController[] = flatten([
      // session.execution.started

      eventListenerPair(
        ctx: ctx,
        onError: defaultErrorEvent,
        startTypes: ['session.step.started'],
        startEvent: (event) => {
          findOrCreateSpan(`session.execution-${event.data.sessionID}`, { sessionId: event.data.sessionID, type: 'ai.session.execution' })
        },
        endTypes: ['session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted'],
        endEvent:(event) => {
          stopSpan(`session.execution-${event.data.sessionID}`)
          const provider = useSpanStore.use.provider()
          provider?.forceFlush().then(
            () => debug('[opencode-tracing] Flush succeeded after span end'),
            (err) => debug('[opencode-tracing] Flush FAILED:', err),
          )
        },
      ),

      eventListenerPair(
        ctx: ctx,
        onError: defaultErrorEvent,
        startTypes: ['session.step.started'],
        startEvent: (event) => {
          const sid = event.data.sessionID as string
          const parentSpan = getActiveParentSessionSpan(sid)
          findOrCreateSpan(`session.step${sid}`, undefined, sid, event.data.assistantMessageID, {
            attributes: {
              sessionId: sid,
              type: 'ai.session.execution',
              agent: event.data.agent,
              model: event.data.model?.id,
            },
            links: parentSpan ? [{ context: parentSpan.span.spanContext() }] : [],
          })
        },
        endTypes: ['session.step.ended'],
        endEvent:(event) => {
          const sid = event.data.sessionID as string
          const parentSpan = getActiveParentSessionSpan(sid)
          findOrCreateSpan(`session.step${sid}`, undefined, sid, event.data.assistantMessageID, {
            attributes: {
              sessionId: sid,
              type: 'ai.session.execution',
              agent: event.data.agent,
              model: event.data.model?.id,
            },
            links: parentSpan ? [{ context: parentSpan.span.spanContext() }] : [],
          })
        },
      ),

      eventListener({
        types: ['session.inbox.delivered'],
        ctx,
        onEvent: (event) => {
          const span = getActiveParentSessionSpan(event.data.sessionID as string)
          if (span) {
            span.span.setAttribute('msgId', event.data.inboxID as string)
          }
        },
        onError: (err) => {
          if ((err as Error)?.name !== 'AbortError') {
            logError('Error in forked handler', err)
          }
        },
      }),

      // All events debug log
      eventListener({
        types: ['*', '-session.reasoning.delta', '-session.text.delta', '-session.compaction.delta'],
        ctx,
        onEvent: (event) => {
          debug(`[opencode-tracing] EVENT type=${event.type}`)
          if (new Set(SHOW_FULL_DATA).has(event.type)) {
            debug(`[opencode-tracing] ${event.type} EVENT data=${inspect(event, { depth: 3, colors: true })}`)
          }
        },
        onError: (err) => {
          if ((err as Error)?.name !== 'AbortError') {
            logError('Error in forked handler', err)
          }
        },
      }),
    ])

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return async () => {
      debug('[opencode-tracing] Shutdown — flushing spans...')
      controllers.forEach((c) => c.abort())
      clearInterval(cleanupTimer)
      await useSpanStore.getState().shutdownProvider()
    }
  },
})
