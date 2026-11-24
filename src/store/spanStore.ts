import { createStore } from 'zustand/vanilla'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Span, trace  } from '@opentelemetry/api'
import { createSelectors } from '@helpers/store'
import {result} from 'lodash'

interface SpanEntry {
  spanName: string
    lookupInfo?:{
      sessionId?: string
      messageId?: string
      type?: string
    }
    attributes: any
  span: Span
}

interface ProviderAttrs {
  [key: string]: string | number | boolean
}

interface SpanStore {
  spans: SpanEntry[]
  provider: BasicTracerProvider | undefined
  exporter: OTLPTraceExporter | undefined
  addSpan: (entry: Omit<SpanEntry, 'span'> & { span: Span }) => void
  removeSpan: (sessionName: string, sessionId?: string, messageId?: string) => void
  clear: () => void
  findSpan: (spanName?: string, lookupInfo?: { sessionId?: string; messageId?: string }) => SpanEntry | undefined
  initProvider: (resourceAttrs: ProviderAttrs, exporter: OTLPTraceExporter, maxQueueSize?: number, maxExportBatchSize?: number, exportTimeoutMillis?: number) => void
  shutdownProvider: () => Promise<void>
  replaceProvider: (resourceAttrs: ProviderAttrs, exporter: OTLPTraceExporter, maxQueueSize?: number, maxExportBatchSize?: number, exportTimeoutMillis?: number) => Promise<void>
}

function spanCompare(spanEntry, spanName, lookupInfo){
    if(spanName == undefined && lookupInfo?.type == undefined){
        return false
    }

    const result = (spanName == undefined || spanEntry.spanName === spanName) &&
        (lookupInfo?.type == undefined || spanEntry?.lookupInfo?.type === lookupInfo.type) &&
        (lookupInfo?.sessionId == undefined || spanEntry?.lookupInfo?.sessionId === lookupInfo.sessionId) &&
        (lookupInfo?.messageId == undefined || spanEntry?.lookupInfo?.messageId === lookupInfo.messageId)
    return result

}

const baseStore = createStore<SpanStore>((set, get) => ({
  spans: [],
  provider: undefined,
  exporter: undefined,

  addSpan: (entry) =>
    set((state) => ({
      spans: [...state.spans, entry],
    })),

  removeSpan: (spanName, lookupInfo = {}) =>
    set((state) => ({
      spans: state.spans.filter((s) =>
          !spanCompare(s, spanName, lookupInfo)
      ),
    })),

    clear: () => set({ spans: [], provider: undefined, exporter: undefined }),

  findSpan: (spanName, lookupInfo = {}) => {
    const { spans } = get()
    return spans.find((span) => {
        return spanCompare(span, spanName, lookupInfo)
    })
  },

  initProvider: (resourceAttrs, exporter, maxQueueSize = 100, maxExportBatchSize = 100, exportTimeoutMillis = 5000) => {
    const resource = resourceFromAttributes(resourceAttrs)
    const provider = new BasicTracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor(exporter, {
          maxQueueSize,
          maxExportBatchSize,
          exportTimeoutMillis,
        }),
      ],
    })
    trace.setGlobalTracerProvider(provider)
    debug(`${inspect(store.use.provider(), {depth: 4})}`)
    set({ provider, exporter })
  },

  shutdownProvider: async () => {
    const { provider, exporter } = get()
    if (provider) await provider.shutdown()
    set({ provider: undefined, exporter: undefined })
  },

  replaceProvider: async (resourceAttrs, newExporter, maxQueueSize = 100, maxExportBatchSize = 100, exportTimeoutMillis = 5000) => {
    const { provider } = get()
    if (provider) await provider.shutdown()
    const resource = resourceFromAttributes(resourceAttrs)
    const newProvider = new BasicTracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor(newExporter, {
          maxQueueSize,
          maxExportBatchSize,
          exportTimeoutMillis,
        }),
      ],
    })
    set({ provider: newProvider, exporter: newExporter })
  },
}))

export const spanStore = createSelectors(baseStore, ['spans', 'provider', 'exporter', 'findSpan', 'removeSpan', 'addSpan', 'initProvider', 'shutdownProvider', 'replaceProvider'  ])
//export const useSpanStore = baseStore
