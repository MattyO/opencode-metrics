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

  describe('selector', () => {
      it('is avalible through a selector', ()=>{
          expect(useSpanStore.use.findSpan).toBeInstanceOf(Function)
      })
  })
  describe('spans not found returns undefined', () => {
      it('when there are spans', ()=>{
          expect(useSpanStore.use.findSpan('not-a-span')).toBeUndefined()
      })
      it('when the span doesnt match', ()=>{
        useSpanStore.use.addSpan('span.name', 'span.type')
        expect(useSpanStore.use.findSpan('not-a-span')).toBeUndefined()
      })
  })

  describe('matching by spanName', () => {
    it('should return the span when spanName matches', () => {

      useSpanStore.use.addSpan('span.name', 'span.type')

      const result = useSpanStore.use.findSpan('span.name')

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('my-span')
    })
  })

  describe('matching by lookupInfo', () => {

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
  })
})
