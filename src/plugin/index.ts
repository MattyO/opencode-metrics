import { Plugin } from "@opencode/plugin"
import { trace, Span } from "@opentelemetry/api"

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
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import { find, filter } from "lodash"
import { inspect } from "util"

import { TracingOptions, ExecutionInfo } from "../types/tracing"
import { logError } from "../utils/logger"
import { debug } from "../utils/plugin"
import { resolveOtlpEndpoint } from "../utils/otel"

// ---------------------------------------------------------------------------
// Module-level singleton — survives hot-reload
// ---------------------------------------------------------------------------

let _provider: BasicTracerProvider | undefined
let _tracer = trace.getTracer("opencode-tracing", "0.1.0")
let _exporter: OTLPTraceExporter | undefined
let _lastEndpoint = ""

// ---------------------------------------------------------------------------
// Internal state helpers
// ---------------------------------------------------------------------------

interface ActiveSpanObj {
  sessionName: string
  sessionId?: string
  messageId?: string
  span: Span
}

function spanCompare(o: ActiveSpanObj, sessionName: string, sessionId?: string, messageId?: string): boolean {
  return o.sessionName === sessionName && (sessionId == undefined || o.sessionId === sessionId) && (messageId == undefined || o.messageId === messageId)
}

function findOrCreateSpan(sessionName: string, attributes?: any, sessionId?: string, messageId?: string, links?: any): ActiveSpanObj {
  const obj = find(active_spans, (o) => spanCompare(o, sessionName, sessionId, messageId))

  debug(`[opencode-tracing] >>> getOrCreateExecution("${sessionId}") found=${!!obj} active_spans (total=${active_spans.length})`)
  if (!obj) {
    const newSpan: ActiveSpanObj = {
      sessionName,
      sessionId,
      messageId,
      span: _tracer.startSpan(sessionName, { attributes, links }),
    }
    active_spans.push(newSpan)
    debug(`[opencode-tracing] PROACTIVE execution span created for ${sessionId}`)
    return newSpan
  }
  return obj
}

function stopSpan(sessionName: string, sessionId?: string, messageId?: string): void {
  const toStop = filter(active_spans, (o) => spanCompare(o, sessionName, sessionId, messageId))
  toStop.forEach((o) => o.span.end())
  // Remove stopped spans from active_spans
  const stoppedNames = new Set(toStop.map((o) => o.sessionName + (o.sessionId || "") + (o.messageId || "")))
  for (let i = active_spans.length - 1; i >= 0; i--) {
    const o = active_spans[i]
    const key = o.sessionName + (o.sessionId || "") + (o.messageId || "")
    if (stoppedNames.has(key)) {
      active_spans.splice(i, 1)
    }
  }
}

function getActiveParentSessionSpan(sessionId: string): ActiveSpanObj | undefined {
  return findOrCreateSpan(`session.execution-${sessionId}`)
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const active_spans: ActiveSpanObj[] = []

export default Plugin.define({
  id: "opencode-tracing",

  async setup(ctx: PluginContext) {
    const opts: TracingOptions = {
      enabled: true,
      sampleRate: 1,
      ...(ctx.options as Partial<TracingOptions>),
    }
    if (!opts.enabled) {
      debug("[opencode-tracing] Tracing disabled via options")
      return
    }

    const endpoint = resolveOtlpEndpoint(opts)
    const serviceName = opts.serviceName ?? "opencode-tracing"

    debug(`[opencode-tracing] ENDPOINT = ${endpoint}`)

    // -----------------------------------------------------------------------
    // OpenTelemetry provider — recreate on endpoint change or first load
    // -----------------------------------------------------------------------

    _lastEndpoint = "__FORCE_RELOAD__"
    const needsNewProvider = !_provider || _lastEndpoint === "__FORCE_RELOAD__"
    if (needsNewProvider) {
      if (_provider) {
        debug("[opencode-tracing] Endpoint changed, shutting down old provider...")
        await _provider.shutdown()
        _provider = undefined
        _exporter = undefined
      }
      debug("[opencode-tracing] Creating new OTel provider")
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: "0.1.0",
      })

      _exporter = new OTLPTraceExporter({
        url: endpoint,
      })

      debug(`[opencode-tracing] >>> RESOURCE service.name=${resource.attributes[ATTR_SERVICE_NAME]}`)

      _provider = new BasicTracerProvider({
        resource,
        spanProcessors: [
          new BatchSpanProcessor(_exporter, {
            maxQueueSize: opts.maxQueueSize ?? 100,
            maxExportBatchSize: opts.maxExportBatchSize ?? 100,
            exportTimeoutMillis: opts.exportTimeoutMillis ?? 5000,
          }),
        ],
      })
      debug(`[opencode-tracing] setting global provider =${!!trace.setGlobalTracerProvider(_provider)}`)

      _tracer = trace.getTracer(serviceName, "0.1.0")
      debug(`[opencode-tracing] OTel provider created, tracer=${inspect(_tracer, { depth: 3, colors: true })}`)
      debug(`[opencode-tracing] OTel provider created, provider=${inspect(_provider, { depth: 3, colors: true })}`)

      _provider!.forceFlush().then(
        () => debug("[opencode-tracing] Initial forceFlush succeeded"),
        (err) => debug("[opencode-tracing] Initial forceFlush FAILED:", err),
      )
    } else {
      debug("[opencode-tracing] Reusing existing OTel provider (hot-reload)")
      _tracer = trace.getTracer(serviceName, "0.1.0")
    }
    _lastEndpoint = endpoint

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    const executions = new Map<string, ExecutionInfo>()
    const seenEvents = new Map<string, number>() // dedup: "type:sessionID:eventKey" → timestamp
    const SESSION_EXPIRY_MS = 300_000 // 5 min — clean up old sessions

    /** Clean up stale session data periodically */
    const cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, ts] of seenEvents) {
        if (now - ts > SESSION_EXPIRY_MS) seenEvents.delete(key)
      }
    }, 60_000)

    /** Dedup: skip if we've seen this event before (handles hot-reload duplicates) */
    function isDuplicate(type: string, sessionID: string, ...keys: string[]): boolean {
      const dedupKey = `${type}:${sessionID}:${keys.join(":")}`
      if (seenEvents.has(dedupKey)) return true
      seenEvents.set(dedupKey, Date.now())
      return false
    }

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------

    const controllers: AbortController[] = []

    // session.execution.started
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening session.execution.started")
        try {
          for await (
            const event of ctx.event.subscribe({ types: ["session.execution.started"], signal: controller.signal })
          ) {
            findOrCreateSpan(`session.execution-${event.data.sessionID}`, { sessionId: event.data.sessionID, type: "ai.session.execution" })
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }

    // session.execution ended
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening session.execution.end events")
        try {
          for await (
            const event of ctx.event.subscribe({
              types: ["session.execution.succeeded", "session.execution.failed", "session.execution.interrupted"],
              signal: controller.signal,
            })
          ) {
            stopSpan(`session.execution-${event.data.sessionID}`)
            _provider!.forceFlush().then(
              () => debug("[opencode-tracing] Flush succeeded after span end"),
              (err) => debug("[opencode-tracing] Flush FAILED:", err),
            )
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }

    // session.inbox.delivered
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening session.inbox.delivered")
        try {
          for await (
            const event of ctx.event.subscribe({ types: ["session.inbox.delivered"], signal: controller.signal })
          ) {
            const span = getActiveParentSessionSpan(event.data.sessionID as string)
            if (span) {
              span.span.setAttribute("msgId", event.data.inboxID as string)
            }
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }

    // session.step.started
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening session.step.started")
        try {
          for await (
            const event of ctx.event.subscribe({ types: ["session.step.started"], signal: controller.signal })
          ) {
            const sid = event.data.sessionID as string
            const parentSpan = getActiveParentSessionSpan(sid)
            findOrCreateSpan(`session.step${sid}`, undefined, sid, event.data.assistantMessageID, {
              attributes: {
                sessionId: sid,
                type: "ai.session.execution",
                agent: event.data.agent,
                model: event.data.model?.id,
              },
              links: parentSpan ? [{ context: parentSpan.span.spanContext() }] : [],
            })
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }

    // session.step.ended
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening session.step.ended")
        try {
          for await (
            const event of ctx.event.subscribe({ types: ["session.step.ended"], signal: controller.signal })
          ) {
            const sid = event.data.sessionID as string
            const parentSpan = getActiveParentSessionSpan(sid)
            findOrCreateSpan(`session.step${sid}`, undefined, sid, event.data.assistantMessageID, {
              attributes: {
                sessionId: sid,
                type: "ai.session.execution",
                agent: event.data.agent,
                model: event.data.model?.id,
              },
              links: parentSpan ? [{ context: parentSpan.span.spanContext() }] : [],
            })
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }

    // All events debug log
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening all events for debug")
        try {
          for await (
            const event of ctx.event.subscribe({ signal: controller.signal })
          ) {
            const showFullData = new Set([
              "session.execution.started",
              "session.execution.succeeded",
              "session.execution.failed",
              "session.execution.interrupted",
              "session.inbox.delivered",
              "session.step.started",
              "session.step.ended",
              "session.step.first-token",
              "session.reasoning.started",
              "session.reasoning.ended",
              "session.tool.called",
              "session.tool.success",
              "session.tool.failed",
              "session.compaction.started",
              "session.compaction.ended",
            ])
            if (event.type !== "session.reasoning.delta" && event.type !== "session.text.delta" && event.type !== "session.compaction.delta") {
              debug(`[opencode-tracing] EVENT type=${event.type}`)
              if (showFullData.has(event.type)) {
                debug(`[opencode-tracing] ${event.type} EVENT data=${inspect(event, { depth: 3, colors: true })}`)
              }
            }
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
      debug("[opencode-tracing] Shutdown — flushing spans...")
      controllers.forEach((c) => c.abort())
      clearInterval(cleanupTimer)
      if (_provider) {
        _provider.shutdown().catch((err) => debug("[opencode-tracing] Provider shutdown error:", err))
      }
    }
  },
})
