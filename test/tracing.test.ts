import { describe, it, expect, beforeEach, rs } from '@rstest/core'
import { spanStore } from '@store/spanStore'
import { createSpan, setupProvider } from '@utils/tracing'

import { TracingOptions, ExecutionInfo } from '@types/tracing'

// ---------------------------------------------------------------------------
// Clear the real store before each test
// ---------------------------------------------------------------------------

function clearStore() {
  spanStore.getState().clear()
}

// ---------------------------------------------------------------------------
// Import after store is available (OTel API is aliased to mock via rsbuild)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------


describe('tracing/initProvider', () => {
  beforeEach(clearStore)
    it('calls init provider store selector to create provider', ()=>{
        const spy = rs.spyOn(spanStore.use, 'initProvider')
        const opts: TracingOptions = {
          enabled: true,
          sampleRate: 1,
        }

        setupProvider(
            'http://localhost:4318',
            'opencode-tracing',
            opts,
        )

        expect(spy).toHaveBeenCalled()
    })

    it('doesnt create a new new provider when there already is one', ()=>{
        const spy = rs.spyOn(spanStore.use, 'initProvider')
        const opts: TracingOptions = {
          enabled: true,
          sampleRate: 1,
        }

        setupProvider(
            'http://localhost:4318',
            'opencode-tracing',
            opts,
        )

        expect(spy).toHaveBeenCalled()
        spy.mockClear()

        setupProvider(
            'http://localhost:4318',
            'opencode-tracing',
            opts,
        )

        expect(spy).not.toHaveBeenCalled()
    })

    it('creates a provider when its forced to', ()=>{
        const spy = rs.spyOn(spanStore.use, 'initProvider')
        const opts: TracingOptions = {
          enabled: true,
          sampleRate: 1,
        }

        setupProvider(
            'http://localhost:4318',
            'opencode-tracing',
            opts,
        )

        expect(spy).toHaveBeenCalled()
        spy.mockClear()

        setupProvider(
            'http://localhost:4318',
            'opencode-tracing',
            opts,
            true
        )

        expect(spy).toHaveBeenCalled()
    })

    it('creates a new provider when the endpoints have changed', ()=>{
        const spy = rs.spyOn(spanStore.use, 'initProvider')
        const opts: TracingOptions = {
          enabled: true,
          sampleRate: 1,
        }

        setupProvider(
            'http://localhost:4318',
            'opencode-tracing',
            opts,
        )

        expect(spy).toHaveBeenCalled()
        spy.mockClear()

        setupProvider(
            'http://changed-endpoint:4318',
            'opencode-tracing',
            opts,
        )

        expect(spy).toHaveBeenCalled()
    })

    it('calls init provider store selector to create provider', ()=>{
        const spy = rs.spyOn(spanStore.use, 'initProvider')
        const opts: TracingOptions = {
          enabled: true,
          sampleRate: 1,
        }

        setupProvider(
            'http://localhost:4318',
            'opencode-tracing',
            opts,
            true
        )

        expect(spy).toHaveBeenCalled()
    })

    describe('when reloading provider', ()=>{
        it('flushs old provider', ()=>{

            const spy = rs.spyOn(spanStore.use, 'shutdownProvider')
            const opts: TracingOptions = {
              enabled: true,
              sampleRate: 1,
            }

            setupProvider(
                'http://localhost:4318',
                'opencode-tracing',
                opts,
                false,
            )

            expect(spy).not.toHaveBeenCalled()

            setupProvider(
                'http://localhost:4318',
                'opencode-tracing',
                opts,
                true
            )

            expect(spy).toHaveBeenCalled()
        })
    })
})

describe('tracing/createSpan', () => {
  beforeEach(clearStore)

  it('should register the span in the store', () => {

    createSpan('my-span', { type: 'test' })

    const entry = spanStore.getState().findSpan('my-span')
    expect(entry).toBeDefined()
    expect(entry?.spanName).toBe('my-span')
    expect(entry?.type).toBe('test')
  })

  it('should apply attributes to the span', () => {
    createSpan('attr-span', {
      type: 'attr-test',
      attributes: { foo: 'bar', count: 42 },
    })

    const entry = spanStore.getState().findSpan('attr-span')
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

    const entry = spanStore.getState().findSpan('parented-span')
    expect(entry).toBeDefined()
    expect(entry?.spanName).toBe('parented-span')
  })

  it('should store lookupInfo when provided', () => {
    createSpan('lookup-span', {
      type: 'lookup',
      lookupInfo: { sessionId: 'session-1', messageId: 'msg-1' },
    })

    const entry = spanStore.getState().findSpan('lookup-span')
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
    const entry = spanStore.getState().findSpan('no-options-span')
    expect(entry).toBeDefined()
    expect(entry?.spanName).toBe('no-options-span')
  })
})
