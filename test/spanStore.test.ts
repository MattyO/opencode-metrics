import { describe, it, expect, beforeEach } from '@rstest/core'
import { spanStore } from '@/store/spanStore'
import { createSpanEntry } from '@testHelpers/spanEntry'

// ---------------------------------------------------------------------------
// Helper: clear the store before each test
// ---------------------------------------------------------------------------

function clearStore() {
  spanStore.setState({ spans: [] })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpanStore', () => {
  beforeEach(clearStore)

  it('should start with an empty spans array', () => {
    expect(spanStore.getState().spans).toEqual([])
  })

  describe('findSpan selector', () => {
    it('is available through a selector', () => {
      expect(spanStore.use.findSpan).toBeInstanceOf(Function)
    })
  })

  describe('findSpan — spans not found', () => {
    it('returns undefined when there are spans but name does not match', () => {
      spanStore.use.addSpan(createSpanEntry({ spanName: 'span.name' }))
      expect(spanStore.getState().findSpan('not-a-span')).toBeUndefined()
    })

    it('returns undefined when store is empty', () => {
      const result = spanStore.getState().findSpan()
      expect(result).toBeUndefined()
    })
  })

  describe('findSpan — matching by spanName', () => {
    it('returns the span when spanName matches', () => {
      spanStore.use.addSpan(createSpanEntry({ spanName: 'span.name' }))

      const result = spanStore.use.findSpan('span.name')

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('span.name')
    })

    it('returns the first matching span when multiple exist', () => {
      spanStore.getState().addSpan(createSpanEntry({ spanName: 'step-span', type: 'step' }))
      spanStore.getState().addSpan(createSpanEntry({ spanName: 'step-span', type: 'step' }))

      const result = spanStore.getState().findSpan('step-span')

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('step-span')
    })
  })

  describe('findSpan — matching by lookupInfo', () => {
    it('finds the span when name and lookupInfo match', () => {
      spanStore.use.addSpan(createSpanEntry({
        spanName: 'step-span',
        lookupInfo: { sessionId: '123', messageId: '' },
      }))
      spanStore.use.addSpan(createSpanEntry({
        spanName: 'step-span',
        lookupInfo: { sessionId: '456', messageId: '' },
      }))

      const result = spanStore.use.findSpan('step-span', { sessionId: '123' })

      expect(result).toBeDefined()
      expect(result.spanName).toEqual('step-span')
      expect(result.lookupInfo).toEqual({ sessionId: '123', messageId: '' })
    })
  })

  describe('removeSpan', () => {
    it('should remove only the matching span', () => {
      spanStore.use.addSpan(createSpanEntry({ spanName: 'keep-me' }))
      spanStore.use.addSpan(createSpanEntry({ spanName: 'remove-me' }))

      spanStore.getState().removeSpan('remove-me', {})

      expect(spanStore.getState().spans).toHaveLength(1)
      expect(spanStore.getState().spans[0]?.spanName).toBe('keep-me')
    })
  })
})
