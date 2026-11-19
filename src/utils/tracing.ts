import { Span, trace, context } from '@opentelemetry/api'

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
