// Mock for @opentelemetry/api — avoids ESM sub-module resolution issues in rspack
const mockSpan: any = {
  setAttribute: () => {},
  addEvent: () => {},
  setStatus: () => {},
  addLink: () => {},
  updateName: () => {},
  end: () => {},
  spanContext: () => ({ traceId: 'mock', spanId: 'mock', traceFlags: 1 }),
  isRecording: () => true,
}
const mockTracer = { startSpan: () => ({ ...mockSpan }) }

export const context = { active: () => null }
export const trace = {
  getTracer: () => mockTracer,
  setSpan: () => {}, setSpanContext: () => {},
  getActiveSpan: () => undefined,
  wrap: () => {}, with: () => {},
}
export class Span {
  setAttribute() {} addEvent() {} setStatus() {} addLink() {}
  updateName() {} end() {}
  spanContext() { return { traceId: 'mock', spanId: 'mock', traceFlags: 1 } }
  isRecording() { return true }
}
export const SpanKind = { INTERNAL: 0, SERVER: 1, CLIENT: 2, PRODUCER: 3, CONSUMER: 4 } as const
export const SpanStatusCode = { UNSET: 0, OK: 1, ERROR: 2 } as const
export const TraceFlags = { NONE: 0, SAMPLED: 1 } as const
export const SamplingDecision = { NOT_RECORD: 0, RECORD: 1, RECORD_AND_SAMPLED: 2 } as const
export const INVALID_SPANID = '0000000000000000'
export const INVALID_TRACEID = '00000000000000000000000000000000'
export const INVALID_SPAN_CONTEXT = null
export function createTraceState() { return null }
export function isSpanContextValid() { return false }
export function isValidTraceId() { return false }
export function isValidSpanId() { return false }
