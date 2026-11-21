import { Span, trace, context } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { TracingOptions } from '@/types/tracing'
import { debug } from '@/utils/plugin'
import { spanStore } from '@/store/spanStore'

// ---------------------------------------------------------------------------
// Module-level singleton — survives hot-reload (endpoint string only, cheap to recreate)
// ---------------------------------------------------------------------------

let _lastEndpoint = ''

// ---------------------------------------------------------------------------
// Provider setup
// ---------------------------------------------------------------------------

export function setupProvider(
  endpoint: string,
  serviceName: string,
  opts: TracingOptions,
  forceReload?: boolean,
): void {
  const store = spanStore
  const needsNewProvider = !store.use.provider() || forceReload || _lastEndpoint === '__FORCE_RELOAD__'

  if (needsNewProvider) {
    // Shut down old provider via store
    if (store.use.provider()) {
      debug('[opencode-tracing] Endpoint changed, shutting down old provider...')
      void store.shutdownProvider()
    }

    debug('[opencode-tracing] Creating new OTel provider')

    const exporter = new OTLPTraceExporter({
      url: endpoint,
    })

   const resourceAttrs = {
      ['service.name']: serviceName,
      ['service.version']: '0.1.0',
    }

    debug(`[opencode-tracing] >>> RESOURCE service.name=${serviceName}`)

    store.initProvider(resourceAttrs, exporter, opts.maxQueueSize ?? 100, opts.maxExportBatchSize ?? 100, opts.exportTimeoutMillis ?? 5000)

    const provider = store.use.provider()
    if (provider) {
      debug(`[opencode-tracing] setting global provider =${!!trace.setGlobalTracerProvider(provider)}`)
      provider.forceFlush().then(
        () => debug('[opencode-tracing] Initial forceFlush succeeded'),
        (err) => debug('[opencode-tracing] Initial forceFlush FAILED:', err),
      )
    }
  } else {
    debug('[opencode-tracing] Reusing existing OTel provider (hot-reload)')
  }

  _lastEndpoint = endpoint
}

/**
 * Create a named span via the OTel tracer and register it in the span store.
 *
 * @param name      - Span name
 * @param options   - Optional parent span, type, lookup info, and attributes
 * @returns The newly created Span
 */
export function createSpan(
  name: string,
  options: {
    parent?: Span
    type: string
    lookupInfo?: { sessionId: string; messageId: string }
    attributes?: Record<string, string | number | boolean>
  } = {},
): Span {
  const tracer = trace.getTracer('opencode-tracing', '0.1.0')

  // Build startSpan options — attributes go on the span at creation time
  const spanOpts: { attributes?: Record<string, string | number | boolean> } = {}
  if (options.attributes) {
    spanOpts.attributes = options.attributes
  }

  let span: Span
  if (options.parent) {
    const ctx = trace.setSpan(context.active(), options.parent)
    span = tracer.startSpan(name, spanOpts, ctx)
  } else {
    span = tracer.startSpan(name, spanOpts)
  }

  // Register in the store
  spanStore.use.addSpan({
    spanName: name,
    type: options.type,
    lookupInfo: options.lookupInfo,
    span,
  })

  return span
}

/**
 * Safely end a span, ignoring if already ended or undefined.
 */
export function endSpan(span?: Span): void {
  if (span && !span.isRecording()) {
    return
  }
  span?.end()
}

/**
 * Set an attribute on a span, silently skipping if span is undefined or not recording.
 */
export function setSpanAttribute(span: Span | undefined, key: string, value: string | number | boolean): void {
  if (!span || !span.isRecording()) return
  span.setAttribute(key, value)
}

// ---------------------------------------------------------------------------
// Span lookup / creation (TBD — relies on other functions to be fixed first)
// ---------------------------------------------------------------------------

export function findOrCreateSpan(
  name: string,
  type: string,
  lookupInfo: unknown,
  spanAttributes: Record<string, unknown>,
): void {
    let span = store.selectors.findSpan(name, type, lookupInfo)
    if(!span){
        span = createSpan(name, type, lookupinfo, attributes)
   }
    return span
}

export function flushProvider(){
    const provider = spanStore.use.provider()
    provider?.forceFlush().then(
        () => debug('[opencode-tracing] Flush succeeded after span end'),
        (err) => debug('[opencode-tracing] Flush FAILED:', err),
    )
}


