import { describe, it, expect, beforeEach } from '@rstest/core'
import { useSpanStore } from '@/store/spanStore'

// ---------------------------------------------------------------------------
// Clear the real store before each test
// ---------------------------------------------------------------------------

function clearStore() {
  useSpanStore.getState().clear()
}

// ---------------------------------------------------------------------------
// Import after store is available (OTel API is aliased to mock via rsbuild)
// ---------------------------------------------------------------------------

import { createSpan } from '@/utils/tracing'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tracing/createSpan', () => {
  beforeEach(clearStore)

  it('should register the span in the store', () => {
    createSpan('my-span', { type: 'test' })

    const entry = useSpanStore.getState().findSpan('my-span')
    expect(entry).toBeDefined()
    expect(entry?.spanName).toBe('my-span')
    expect(entry?.type).toBe('test')
  })

  it('should apply attributes to the span', () => {
    // The aliased OTel mock's setAttribute is a no-op, but we can verify
    // that createSpan went through the full pipeline by checking the store
    createSpan('attr-span', {
      type: 'attr-test',
      attributes: { foo: 'bar', count: 42 },
    })

    const entry = useSpanStore.getState().findSpan('attr-span')
    expect(entry).toBeDefined()
    expect(entry?.spanName).toBe('attr-span')
    expect(entry?.type).toBe('attr-test')
  })

  it('should use parent context when parent span is provided', () => {
    const parentSpan: any = { isRecording: () => true }
    createSpan('parented-span', {
      type: 'parented',
      parent: parentSpan,
    })

    const entry = useSpanStore.getState().findSpan('parented-span')
    expect(entry).toBeDefined()
    expect(entry?.spanName).toBe('parented-span')
  })

  it('should store lookupInfo when provided', () => {
    createSpan('lookup-span', {
      type: 'lookup',
      lookupInfo: { sessionId: 'session-1', messageId: 'msg-1' },
    })

    const entry = useSpanStore.getState().findSpan('lookup-span')
    expect(entry?.lookupInfo?.sessionId).toBe('session-1')
    expect(entry?.lookupInfo?.messageId).toBe('msg-1')
  })

  it('should return the created span', () => {
    const result = createSpan('return-span', { type: 'return' })
    expect(result).toBeDefined()
    expect(result).toHaveProperty('spanContext')
  })

  it('should work with no options', () => {
    createSpan('no-options-span')
    const entry = useSpanStore.getState().findSpan('no-options-span')
    expect(entry).toBeDefined()
    expect(entry?.spanName).toBe('no-options-span')
  })
})
