import { describe, it, expect, beforeEach } from '@rstest/core'
import { useSpanStore } from '@/store/spanStore'

// ---------------------------------------------------------------------------
// Helper: clear the store before each test
// ---------------------------------------------------------------------------

function clearStore() {
  useSpanStore.setState({ spans: [] })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('spanStore/findSpan', () => {
  beforeEach(clearStore)

  describe('matching by spanName', () => {
    it('should return the span when spanName matches', () => {
      const mockSpan = {
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
        isRecording: () => true,
      }
      useSpanStore.getState().addSpan({ spanName: 'my-span', type: 'test', span: mockSpan })

      const result = useSpanStore.getState().findSpan('my-span')

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('my-span')
    })

    it('should return undefined when spanName does not match', () => {
      const mockSpan = {
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
        isRecording: () => true,
      }
      useSpanStore.getState().addSpan({ spanName: 'my-span', type: 'test', span: mockSpan })

      const result = useSpanStore.getState().findSpan('non-existent')

      expect(result).toBeUndefined()
    })
  })

  describe('matching by lookupInfo', () => {
    it('should return the span when lookupInfo.sessionId matches', () => {
      const mockSpan = {
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
        isRecording: () => true,
      }
      useSpanStore.getState().addSpan({
        spanName: 'step-span',
        type: 'step',
        lookupInfo: { sessionId: 'session-1', messageId: 'msg-1' },
        span: mockSpan,
      })

      const result = useSpanStore.getState().findSpan(undefined, { sessionId: 'session-1' })

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('step-span')
    })

    it('should return the span when lookupInfo.messageId matches', () => {
      const mockSpan = {
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
        isRecording: () => true,
      }
      useSpanStore.getState().addSpan({
        spanName: 'step-span',
        type: 'step',
        lookupInfo: { sessionId: 'session-1', messageId: 'msg-1' },
        span: mockSpan,
      })

      const result = useSpanStore.getState().findSpan(undefined, { messageId: 'msg-1' })

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('step-span')
    })

    it('should return undefined when lookupInfo does not match', () => {
      const mockSpan = {
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
        isRecording: () => true,
      }
      useSpanStore.getState().addSpan({
        spanName: 'step-span',
        type: 'step',
        lookupInfo: { sessionId: 'session-1', messageId: 'msg-1' },
        span: mockSpan,
      })

      const result = useSpanStore.getState().findSpan(undefined, { sessionId: 'session-999' })

      expect(result).toBeUndefined()
    })
  })

  describe('fallback when lookupInfo is undefined', () => {
    it('should return the first span when lookupInfo is undefined', () => {
      const mockSpan = {
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
        isRecording: () => true,
      }
      useSpanStore.getState().addSpan({ spanName: 'span-a', type: 'a', span: mockSpan })
      useSpanStore.getState().addSpan({ spanName: 'span-b', type: 'b', span: mockSpan })

      const result = useSpanStore.getState().findSpan(undefined, undefined)

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('span-a')
    })
  })

  describe('edge cases', () => {
    it('should return undefined when store is empty', () => {
      const result = useSpanStore.getState().findSpan()
      expect(result).toBeUndefined()
    })

    it('should return the first matching span when multiple exist', () => {
      const mockSpan = {
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
        isRecording: () => true,
      }
      useSpanStore.getState().addSpan({ spanName: 'step-span', type: 'step', span: mockSpan })
      useSpanStore.getState().addSpan({ spanName: 'step-span', type: 'step', span: mockSpan })

      const result = useSpanStore.getState().findSpan('step-span')

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('step-span')
    })

    it('should prioritize spanName match over lookupInfo match', () => {
      const mockSpan = {
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
        isRecording: () => true,
      }
      useSpanStore.getState().addSpan({
        spanName: 'target',
        type: 'target',
        span: mockSpan,
      })
      useSpanStore.getState().addSpan({
        spanName: 'other',
        type: 'other',
        lookupInfo: { sessionId: 'session-1', messageId: 'msg-1' },
        span: mockSpan,
      })

      const result = useSpanStore.getState().findSpan('target', { sessionId: 'session-1' })

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('target')
    })
  })
})
