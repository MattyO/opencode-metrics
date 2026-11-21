import { describe, it, expect, beforeEach } from '@rstest/core'
import { spanStore } from '@/store/spanStore'

// ---------------------------------------------------------------------------
// Helper: clear the store before each test
// ---------------------------------------------------------------------------

function clearStore() {
  spanStore.setState({ spans: [] })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('spanStore/findSpan', () => {
  beforeEach(clearStore)

  describe('selector', () => {
      it('is avalible through a selector', ()=>{
          expect(spanStore.use.findSpan).toBeInstanceOf(Function)
      })
  })
  describe('spans not found returns undefined', () => {
      it('when there are spans', ()=>{
          expect(spanStore.getState().findSpan('not-a-span')).toBeUndefined()
      })
      it('when the span doesnt match', ()=>{
        spanStore.use.addSpan({spanName: 'span.name'})
        expect(spanStore.use.findSpan('not-a-span')).toBeUndefined()
      })
  })

  describe('matching by spanName', () => {
    it('should return the span when spanName matches', () => {

      spanStore.use.addSpan({spanName: 'span.name'})
        console.log(spanStore.getState())

      const result = spanStore.use.findSpan('span.name')

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('span.name')
    })
  })

  describe('matching by lookupInfo', () => {
      it('finds the span when the name matchs and the lookupInfo matches',()=>{
          const mockSpan = {
            setAttribute: () => {},
            end: () => {},
            spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
            isRecording: () => true,
          }
          spanStore.use.addSpan({ spanName: 'step-span', lookupInfo: {sessionId: "123"}, span: mockSpan })
          spanStore.use.addSpan({ spanName: 'step-span', lookupInfo: {sessionId: "456"}, span: mockSpan })

          const result = spanStore.use.findSpan('step-span', {sessionId: '123'})

          expect(result).toBeDefined()
          expect(result.spanName).toEqual('step-span')
          expect(result.lookupInfo).toEqual({sessionId: '123'})
      })
      it('ignores keys where lookupInfo isnt defined and span info is defined', ()=>{
      })

  })

  describe('edge cases', () => {
    it('should return undefined when store is empty', () => {
      const result = spanStore.getState().findSpan()
      expect(result).toBeUndefined()
    })

    it('should return the first matching span when multiple exist', () => {
      const mockSpan = {
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'abc', spanId: 'def', traceFlags: 1 }),
        isRecording: () => true,
      }
      spanStore.getState().addSpan({ spanName: 'step-span', type: 'step', span: mockSpan })
      spanStore.getState().addSpan({ spanName: 'step-span', type: 'step', span: mockSpan })

      const result = spanStore.getState().findSpan('step-span')

      expect(result).toBeDefined()
      expect(result?.spanName).toBe('step-span')
    })
  })
})
