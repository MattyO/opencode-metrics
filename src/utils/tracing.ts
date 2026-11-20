import { Span, trace, context } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { TracingOptions } from '@/types/tracing'
import { debug } from '@/utils/plugin'
import { useSpanStore } from '@/store/spanStore'

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
  const store = useSpanStore
  const needsNewProvider = !store.use.provider() || forceReload || _lastEndpoint === '__FORCE_RELOAD__'

  if (needsNewProvider) {
    // Shut down old provider via store
    if (store.use.provider()) {
      debug('[opencode-tracing] Endpoint changed, shutting down old provider...')
      void store.shutdownProvider()
    }

    debug('[opencode-tracing] Creating new OTel provider')

    const existingExporter = store.use.exporter()
    const ExporterCtor = existingExporter?.constructor ?? OTLPTraceExporter
    const exporter = new ExporterCtor({
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
 * Create a named span, optionally linked to a parent span's context.
 */
export function createSpan(name: string, parent?: Span): Span {
  const tracer = trace.getTracer('opencode-tracing', '0.1.0')
  if (parent) {
    const ctx = trace.setSpan(context.active(), parent)
    return tracer.startSpan(name, {}, ctx)
  }
  return tracer.startSpan(name)
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
