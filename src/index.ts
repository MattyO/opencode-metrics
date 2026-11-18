import { Plugin } from "@opencode/plugin"
import { trace, SpanStatusCode, Span } from "@opentelemetry/api"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BasicTracerProvider, BatchSpanProcessor, SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { SpanExporter, ExportResult, ExportResultCode } from "@opentelemetry/core"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import * as fs from "node:fs"
import { find, remove, without, filter } from "lodash"

import { inspect } from 'util';

const DEBUG_LOG = "/tmp/opencode-tracing-debug.log"
function debug(...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")}\n`
  fs.appendFileSync(DEBUG_LOG, line)
}

function logError(label: string, err: unknown): void {
  const e = err as Error
  const detail = e?.stack || e?.message || e?.name || String(err)
  debug(`[opencode-tracing] ${label}: ${detail}`)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TracingOptions {
  endpoint?: string
  username?: string
  password?: string
  enabled?: boolean
  serviceName?: string
  sampleRate?: number
  maxQueueSize?: number
  maxExportBatchSize?: number
  exportTimeoutMillis?: number
  exportIntervalMillis?: number
}

interface StepInfo {
  span: Span
  started: number
}

interface ExecutionInfo {
  span: Span
  steps: Map<string, StepInfo>
  toolsProcessed: Set<string>
  _toolSpans: Map<string, Span>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveOtlpEndpoint(options: TracingOptions): string {
  // The OTel HTTP exporter v0.200.x uses user-provided URL as-is (no auto /v1/traces suffix).
  // We must include the full OTLP traces endpoint path.
  let ep = options.endpoint ?? process.env.TEMPO_OTLP_ENDPOINT ?? "http://localhost:4317"

  debug(`[opencode-tracing] endpoint ${ep}`)
  ep = ep.replace(/\/+$/, "")
  // Ensure the path ends with /v1/traces
  //if (!ep.endsWith("/v1/traces")) ep += "/v1/traces"
  if (!ep.match(/^https?:\/\//)) ep = `http://${ep}`
  return ep
}

function resolveAuthHeader(options: TracingOptions): string | undefined {
  const user = options.username ?? process.env.TEMPO_USERNAME
  const pass = options.password ?? process.env.TEMPO_PASSWORD
  if (user && pass) return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`
  return undefined
}

function tsToHRTime(ts: number): [number, number] {
  const secs = Math.floor(ts)
  const nanos = Math.round((ts - secs) * 1_000_000_000)
  return [secs, nanos]
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/** Module-level singleton — survives hot-reload */
let _provider: BasicTracerProvider | undefined
let _tracer = trace.getTracer("opencode-tracing", "0.1.0")
let _exporter: OTLPTraceExporter | undefined
let _lastEndpoint = ""

export default Plugin.define({
  id: "opencode-tracing",

  async setup(ctx) {
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

    // Force reload on every setup() call (survives hot-reload singleton)
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
          //new SimpleSpanProcessor({ exporter: new ConsoleSpanExporter() }),
          //new SimpleSpanProcessor({ exporter: new FileSpanExporter() }),
          new BatchSpanProcessor(_exporter, {
            maxQueueSize: opts.maxQueueSize ?? 100,
            maxExportBatchSize: opts.maxExportBatchSize ?? 100,
            exportTimeoutMillis: opts.exportTimeoutMillis ?? 5000,
            exportIntervalMillis: opts.exportIntervalMillis ?? 1000,
          }),
        ],
      })
      debug(`[opencode-tracing] setting global provider =${!!trace.setGlobalTracerProvider(_provider)}`)

      // Bust the global tracer cache so we get a fresh tracer with the new provider's resource
      _tracer = trace.getTracer(serviceName, "0.1.0")
      debug(`[opencode-tracing] OTel provider created, tracer=${inspect(_tracer, { depth: 3, colors: true })}`)
      debug(`[opencode-tracing] OTel provider created, provider=${inspect(_provider, { depth: 3, colors: true })}`)
      // Immediately flush to verify exporter connectivity
        //
      //debug(`[opencode-tracing] >>> PROVIDER service.name=${resource.attributes[ATTR_SERVICE_NAME]} endpoint=${endpoint}`)
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
    const active_spans = []
    debug(`[opencode-tracing] creating active_spans=${inspect(active_spans,_provider, { depth: 3, colors: true })}`)
    const seenEvents = new Map<string, number>() // dedup: "type:sessionID:eventKey" → timestamp
    const SESSION_EXPIRY_MS = 300_000 // 5 min — clean up old sessions

    /** Clean up stale session data periodically */
    const cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, ts] of seenEvents) {
        if (now - ts > SESSION_EXPIRY_MS) seenEvents.delete(key)
      }
    }, 60_000)

    /** Get (or create) an execution record for a session.
     * Since session.execution.started NEVER fires, we create execution spans
     * proactively on first step/tool event. */
    function spanCompare(o, sessionName: string, sessionId?: string, messageId?: string){
        return o.sessionName==sessionName && (sessionId == undefined || o.sessionId == sessionId) && (messageId == undefined || o.messageId == messageId)
    }

    function findOrCreateSpan(sessionName: string, attributes?: any, sessionId?: string, messageId?: string, links?: any) {
        let obj = find(active_spans, (o) => {
            return spanCompare(o, sessionName, sessionId, messageId )
        })

      debug(`[opencode-tracing] >>> getOrCreateExecution("${sessionId}") found=${!!obj} active_spans (total=${active_spans.size})`)
      if (!span) {
        let obj = {
            sessionName: sessionName,
            sessionId: sessionId,
            messageId: messageId,
            span:  _tracer.startSpan(`${sessionName}`, attributes: attributes, links: links),
        }
        active_spans.push(obj)

        debug(`[opencode-tracing] PROACTIVE execution span created for ${sessionID}`)
      }
      return obj
    }

    function stopSpan(sessionName, sessionId?: string, messageId?: string){
        const to_stop = filter(active_spans, (o) => { return spanCompare(o, sessionName, sessionId, messageId) })
        to_stop.forEach((o) => {o.span.end()})
        without(active_spans, to_stop)
    }

    function getActiveParentSessionSpan(sessionId){
        return findOrCreateSpan(`session.execution-${event.data.sessionID}`)
    }


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
    /** session.execution.succeeded / .failed / .interrupted — close execution span */
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening all events")
        try {
          for await (
            const event of ctx.event.subscribe({types: ['session.execution.started'], signal: controller.signal})
          ) {
            findOrCreateSpan(`session.execution-${event.data.sessionID}`, attributes: {sessionId: event.data.sessionID, type: "ai.session.execution"})
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }

    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] session execution end events")
        try {
          for await (
            const event of ctx.event.subscribe({types: ['session.execution.succeeded','session.execution.failed','session.execution.interrupted'], signal: controller.signal})
          ) {

            stopSpan(`session.execution-${event.data.sessionID}`)

            _provider.forceFlush().then(
              () => debug("[opencode-tracing] Flush succeeded after span end"),
              (err) => debug("[opencode-tracing] Flush FAILED:", err),
            )
            //debug(`[opencode-tracing] >>> active spans after delete : ${inspect(active_spans, { depth: 5, colors: true })}`)

          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }

    const controllers: AbortController[] = []
    /** session.execution.succeeded / .failed / .interrupted — close execution span */
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening all events")
        try {
          for await (
            const event of ctx.event.subscribe({types: ['session.inbox.delivered'], signal: controller.signal})
          ) {
            span = getActiveParentSessionSpan(event.data.sessionID)
            if(span){
                span.setAttribute("msgId", event.data.inboxID)
            }
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }

    const controllers: AbortController[] = []
    /** session.execution.succeeded / .failed / .interrupted — close execution span */
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening all events")
        try {
          for await (
            const event of ctx.event.subscribe({types: ['session.step.started'], signal: controller.signal})
          ) {
            const parent_span = getActiveParentSessionSpan(event.data.sessionID)
            const step_started = findOrCreateSpan(`session.step${event.data.sessionID}`,
                sessionId: event.data.sessionID,
                messageId: event.data.assistantMessageID,
                attributes: {
                    sessionId: event.data.sessionID,
                    type: "ai.session.execution"
                    agent: event.data.agent,
                    model: event.data.model.id
                },
                links: [{ context: parentSpan.span.spanContext() }],
            )
            if(span){
                span.setAttribute("msgId", event.data.inboxID)
            }
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }
    const controllers: AbortController[] = []
    /** session.execution.succeeded / .failed / .interrupted — close execution span */
    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening all events")
        try {
          for await (
            const event of ctx.event.subscribe({types: ['session.step.ended'], signal: controller.signal})
          ) {
            const parent_span = getActiveParentSessionSpan(event.data.sessionID)
            const step_started = findOrCreateSpan(`session.step${event.data.sessionID}`,
                sessionId: event.data.sessionID,
                messageId: event.data.assistantMessageID,
                attributes: {
                    sessionId: event.data.sessionID,
                    type: "ai.session.execution"
                    agent: event.data.agent,
                    model: event.data.model.id
                })
            if(span){
                span.setAttribute("msgId", event.data.inboxID)
            }
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            logError("Error in forked handler", err)
          }
        }
      })()
    }


    {
      const controller = new AbortController()
      controllers.push(controller)
      void (async () => {
        debug("[opencode-tracing] Listening all events")
        try {
          for await (
            const event of ctx.event.subscribe({ signal: controller.signal })
          ) {
              const show_full_data = new Set([
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



              ])
              if(event.type != 'session.reasoning.delta' &&  event.type != 'session.text.delta' && event.type != 'session.compaction.delta'){
                debug(`[opencode-tracing] EVENT type=${event.type }`)
                  if(show_full_data.has(event.type)){
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
