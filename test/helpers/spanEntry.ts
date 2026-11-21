import type { Span } from '@opentelemetry/api'

// Minimal span mock that satisfies the Span interface used by SpanEntry
function createMockSpan(overrides?: Partial<Span>): Span {
  return {
    setAttribute: () => {},
    addEvent: () => {},
    setStatus: () => {},
    addLink: () => {},
    updateName: () => {},
    end: () => {},
    spanContext: () => ({ traceId: 'mock', spanId: 'mock', traceFlags: 1 }),
    isRecording: () => true,
    ...overrides,
  }
}

export interface SpanEntryFactoryOptions {
  spanName?: string
  type?: string
  lookupInfo?: { sessionId: string; messageId: string }
  span?: Span
}

export function createSpanEntry(options: SpanEntryFactoryOptions = {}): ReturnType<typeof import('@/store/spanStore').spanStore.getState>['spans'][number] {
  const { spanName = 'test-span', type = 'test', lookupInfo, span = createMockSpan() } = options
  return {
    spanName,
    type,
    lookupInfo,
    span,
  }
}
