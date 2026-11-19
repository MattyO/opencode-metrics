import { createStore } from 'zustand/vanilla'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Span } from '@opentelemetry/api'
import { createSelectors } from '@/helpers/store'

interface SpanEntry {
  sessionName: string
  sessionId?: string
  messageId?: string
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
  initProvider: (resourceAttrs: ProviderAttrs, exporter: OTLPTraceExporter, maxQueueSize?: number, maxExportBatchSize?: number, exportTimeoutMillis?: number) => void
  shutdownProvider: () => Promise<void>
  replaceProvider: (resourceAttrs: ProviderAttrs, exporter: OTLPTraceExporter, maxQueueSize?: number, maxExportBatchSize?: number, exportTimeoutMillis?: number) => Promise<void>
}

const baseStore = createStore<SpanStore>((set, get) => ({
  spans: [],
  provider: undefined,
  exporter: undefined,

  addSpan: (entry) =>
    set((state) => ({
      spans: [...state.spans, entry],
    })),

  removeSpan: (sessionName, sessionId, messageId) =>
    set((state) => ({
      spans: state.spans.filter(
        (s) =>
          s.sessionName !== sessionName ||
          (sessionId !== undefined && s.sessionId !== sessionId) ||
          (messageId !== undefined && s.messageId !== messageId),
      ),
    })),

  clear: () => set({ spans: [] }),

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

export const useSpanStore = createSelectors(baseStore, ['spans', 'provider'])
