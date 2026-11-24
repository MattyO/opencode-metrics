import { Span, trace, context } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { TracingOptions } from '@types/tracing'
import { debug } from '@utils/plugin'
import { spanStore } from '@store/spanStore'
import { inspect } from 'util'

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
    forceReload: boolean = false,
): void {
    const store = spanStore
    const needsNewProvider = !store.use.provider() || forceReload || _lastEndpoint != endpoint

    if (needsNewProvider) {
        // Shut down old provider via store
        if (store.use.provider()) {
            debug('[opencode-tracing] Endpoint changed, shutting down old provider...')
            void store.use.shutdownProvider()
        }

        debug('[opencode-tracing] Creating new OTel provider: ' + endpoint )

        const exporter = new OTLPTraceExporter({
            url: endpoint,
        })

        const resourceAttrs = {
            ['service.name']: serviceName,
            ['service.version']: '0.1.0',
        }

        try{
            debug(`[opencode-tracing] >>> RESOURCE service.name=${serviceName}`)

            store.use.initProvider(resourceAttrs, exporter, opts.maxQueueSize ?? 100, opts.maxExportBatchSize ?? 100, opts.exportTimeoutMillis ?? 5000)
            debug("after provider")
            debug(`${inspect(store.use.provider(), {depth: 4})}`)
            debug(`[opencode-tracing] Exporter config: ${JSON.stringify((store.use.exporter())) }`)
            debug("after debug provider")

        }catch(err){
            debug('error debuggin setup provider')
            debug(err.message)

        }


    } else {
        debug('[opencode-tracing] Reusing existing OTel provider')
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
    lookupInfo?: { sessionId: string; messageId: string }
    attributes?: Record<string, string | number | boolean>
    spanOptions?: Record<string, string | number | boolean>
  } = {},
) {
  debug(`createSpan.options: ${inspect(options, {depth: 4})}`)
  debug(`[opencode-tracing] createSpan (before create) spans.length: ${spanStore.getState().spans.length} spans`)
  const tracer = trace.getTracer('opencode-tracing', '0.1.0')


  // Build startSpan options — attributes go on the span at creation time
  const spanOpts: { attributes?: Record<string, string | number | boolean> } = {}
  if (options?.attributes) {
    spanOpts.attributes = options.attributes
  } else if (options?.spanOptions?.attributes) {
    spanOpts.attributes = options.spanOptions.attributes
  }

  let span: Span
  debug(`options: ${inspect(spanOpts, {depth: 4})}`)
  if (options.parent) {
    const ctx = trace.setSpan(context.active(), options.parent)
    span = tracer.startSpan(name, spanOpts, ctx)
  } else {
    span = tracer.startSpan(name, spanOpts)
  }

    const spanEntry = {
        spanName: name,
        lookupInfo: options.lookupInfo,
        span: span,
      }

  // Register in the store
  spanStore.use.addSpan(spanEntry)

  debug(`[opencode-tracing] createSpan (after create) spans.length: ${spanStore.getState().spans.length} spans`)

  return spanEntry
}

/**
 * Safely end a span, ignoring if already ended or undefined.
 */
export function endSpan(
  name: string,
  lookupInfo: unknown = {}
): void {
  let spanEntry = spanStore.use.findSpan(name, lookupInfo)
  if (!spanEntry) {
    debug(`[opencode-tracing] endSpan: span not found - name=${name}, lookupInfo=${lookupInfo}`)
    return
  }
  debug(`[opencode-tracing] endSpan: ending span - name=${name}`)
  spanEntry.span.end()
  flushProvider()

  debug(`[opencode-tracing] removing span name=${name}`)
  debug(`[opencode-tracing] store: ${spanStore.getState().spans.length} spans`)
  spanStore.use.removeSpan(name, lookupInfo)
  debug(`[opencode-tracing] store: ${spanStore.getState().spans.length} spans`)
}

/**
 * Set an attribute on a span, silently skipping if span is undefined or not recording.
 */
export function setSpanAttribute(
  name: string,
  lookupInfo: unknown = {},
  attribute,
): void {

  let spanEntry = spanStore.use.findSpan(name, lookupInfo)
  if (!spanEntry) return

  spanEntry.span?.setAttribute(attribute.name, attribute.value)
}

// ---------------------------------------------------------------------------
// Span lookup / creation (TBD — relies on other functions to be fixed first)
// ---------------------------------------------------------------------------

export function findOrCreateSpan(
  name: string,
  lookupInfo: unknown = {},
  spanOptions: Record<string, unknown> ={},
): void {
    debug('in find or create span')
    debug(`attributes: ${inspect(spanOptions, {depth: 4})}`)
    let span = spanStore.use.findSpan(name, lookupInfo)
    if(!span){
        debug('span not found creating')
        const spanEntry = createSpan(name, {lookupInfo: lookupInfo, spanOptions: spanOptions})

    }else{
        debug('span found skipping')
    }
}

export function flushProvider(){
    const provider = spanStore.use.provider()
    provider?.forceFlush().then(
        () => debug('[opencode-tracing] Flush succeeded after span end'),
        (err) => debug('[opencode-tracing] Flush FAILED:', err),
    )
}
export function getActiveParentSessionSpan (sessionId){
    return spanStore.use.findSpan(undefined, {
        sessionId: sessionId,
        type: 'ai.session.execution'

    })
}


