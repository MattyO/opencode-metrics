import { describe, it, expect, rs } from '@rstest/core'
import { eventListener } from '@/utils/plugin'

describe('eventListener', () => {
  it('should return an AbortController', () => {
    const mockCtx = {
      event: {
        subscribe: rs.fn().mockReturnValue((async function* () {})()),
      },
    }

    const controller = eventListener({
      types: ['session.test'],
      onEvent: rs.fn(),
      onError: rs.fn(),
      ctx: mockCtx,
    })

    expect(controller).toBeInstanceOf(AbortController)
  })

  it('should call onEvent for each event emitted by subscribe', async () => {
    const events = [
      { type: 'session.test', data: { key: 'val1' } },
      { type: 'session.test', data: { key: 'val2' } },
    ]
    const mockCtx = {
      event: {
        subscribe: rs.fn().mockReturnValue((async function* () {
          for (const e of events) yield e
        })()),
      },
    }

    const onEvent = rs.fn()
    const controller = eventListener({
      types: ['session.test'],
      onEvent,
      onError: rs.fn(),
      ctx: mockCtx,
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(onEvent).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenCalledWith(events[0])
    expect(onEvent).toHaveBeenCalledWith(events[1])

    controller.abort()
  })

  it('should call onError when subscribe throws (but not AbortError)', async () => {
    const mockCtx = {
      event: {
        subscribe: rs.fn().mockReturnValue((async function* () {
          yield { type: 'session.test', data: {} }
          throw new Error('network failure')
        })()),
      },
    }

    const onError = rs.fn()
    eventListener({
      types: ['session.test'],
      onEvent: rs.fn(),
      onError,
      ctx: mockCtx,
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'network failure' }))
  })

  it('should NOT call onError when AbortController is aborted', async () => {
    const onError = rs.fn()
    const controller = eventListener({
      types: ['session.test'],
      onEvent: rs.fn(),
      onError,
      ctx: {
        event: {
          subscribe: rs.fn().mockReturnValue((async function* () {
            yield { type: 'session.test', data: {} }
          })()),
        },
      },
    })

    controller.abort()

    await new Promise((r) => setTimeout(r, 50))

    expect(onError).not.toHaveBeenCalled()
  })
})
