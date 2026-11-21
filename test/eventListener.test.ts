import { describe, it, expect, rs, beforeEach } from '@rstest/core'
import { eventListener, eventListenerPair, defaultErrorEvent } from '@utils/plugin'
import { logError } from '@utils/log'
import { asyncGeneratorMock, withTimeout} from '@testHelpers/testHelpers'

// Mock logger for defaultErrorEvent tests
rs.mock('@utils/log', () => ({
  logError: rs.fn(),
}))
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
    const {yieldItem, stopExecution, subscribeMock} = asyncGeneratorMock()
    const onEvent = rs.fn()

    const controller = eventListener({
      types: ['session.test'],
      onEvent,
      onError: rs.fn(),
      ctx: {
        event: {
          subscribe: subscribeMock,
        },
      },
    })

    events.forEach(event=> {
      yieldItem(event)

    });

    await withTimeout( stopExecution(), 5000)

    expect(onEvent).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenCalledWith(events[0])
    expect(onEvent).toHaveBeenCalledWith(events[1])
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

  it('should omit "types" from subscribe when types contains "*"', async () => {
    const mockCtx = {
      event: {
        subscribe: rs.fn().mockReturnValue((async function* () {})()),
      },
    }

    eventListener({
      types: ['*', '-session.reasoning.delta'],
      onEvent: rs.fn(),
      onError: rs.fn(),
      ctx: mockCtx,
    })

    expect(mockCtx.event.subscribe).toHaveBeenCalledTimes(1)
    const args = mockCtx.event.subscribe.mock.calls[0][0]
    expect(args).toHaveProperty('signal')
    expect(args).not.toHaveProperty('types')
  })

  it('should pass types array to subscribe as a normal set of strings', async () => {
    const mockCtx = {
      event: {
        subscribe: rs.fn().mockReturnValue((async function* () {})()),
      },
    }

    eventListener({
      types: ['a.event', 'b.event'],
      onEvent: rs.fn(),
      onError: rs.fn(),
      ctx: mockCtx,
    })

    expect(mockCtx.event.subscribe).toHaveBeenCalledTimes(1)
    const args = mockCtx.event.subscribe.mock.calls[0][0]
    expect(args.types).toEqual(['a.event', 'b.event'])
  })

  it('should remove excluded types from subscribe args', async () => {
    const mockCtx = {
      event: {
        subscribe: rs.fn().mockReturnValue((async function* () {})()),
      },
    }

    eventListener({
      types: ['typeOne', 'typeTwo', '-typeOne'],
      onEvent: rs.fn(),
      onError: rs.fn(),
      ctx: mockCtx,
    })

    expect(mockCtx.event.subscribe).toHaveBeenCalledTimes(1)
    const args = mockCtx.event.subscribe.mock.calls[0][0]
    expect(args.types).toEqual(['typeTwo'])
  })

  it('guards against blacklisted function when passed a *', async () => {
    const events = [
      { type: 'session.test', data: { key: 'val1' } },
      { type: 'session.test', data: { key: 'val1' } },
      { type: 'session.exclude', data: { key: 'val2' } },
    ]

    const {yieldItem, stopExecution, subscribeMock} = asyncGeneratorMock()
    const mockCtx = {
      event: {
        subscribe: subscribeMock,
      },
    }
    const onEvent = rs.fn()


    eventListener({
      types: ['*', '-session.exclude'],
      onEvent: onEvent ,
      onError: rs.fn(),
      ctx: mockCtx,
    })

    events.forEach(event=> {
      yieldItem(event)

    });


    await withTimeout( stopExecution(), 5000)
    expect(onEvent).toHaveBeenCalledTimes(2)

  })
})

describe('eventListenerPair', () => {
  it('should return an array of two AbortControllers', () => {
    const mockCtx = {
      event: {
        subscribe: rs.fn().mockReturnValue((async function* () {})()),
      },
    }

    const controllers = eventListenerPair({
      startTypes: ['start.event'],
      endTypes: ['end.event'],
      startEvent: rs.fn(),
      endEvent: rs.fn(),
      onError: rs.fn(),
      ctx: mockCtx,
    })

    expect(Array.isArray(controllers)).toBe(true)
    expect(controllers.length).toBe(2)
    expect(controllers[0]).toBeInstanceOf(AbortController)
    expect(controllers[1]).toBeInstanceOf(AbortController)
  })

  it('should invoke both startEvent and endEvent when events are emitted', async () => {
    const { yieldItem, stopExecution, subscribeMock } = asyncGeneratorMock()
    const startEvent = rs.fn()
    const endEvent = rs.fn()

    eventListenerPair({
      startTypes: ['start.event'],
      endTypes: ['end.event'],
      startEvent,
      endEvent,
      onError: rs.fn(),
      ctx: {
        event: {
          subscribe: subscribeMock,
        },
      },
    })

    yieldItem({ type: 'start.event', data: { key: 'val1' } })
    yieldItem({ type: 'end.event', data: { key: 'val2' } })

    await withTimeout(stopExecution(), 5000)

    // Both listeners iterate over the same events, so both callbacks are invoked
    expect(startEvent).toHaveBeenCalledTimes(1)
    expect(endEvent).toHaveBeenCalledTimes(1)
  })

  it('should call shared onError for errors from either listener', async () => {
    const onError = rs.fn()
    const controllers = eventListenerPair({
      startTypes: ['start.event'],
      endTypes: ['end.event'],
      startEvent: rs.fn(),
      endEvent: rs.fn(),
      onError,
      ctx: {
        event: {
          subscribe: rs.fn().mockReturnValue((async function* () {
            yield { type: 'start.event', data: {} }
            throw new Error('some error')
          })()),
        },
      },
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'some error' }))
  })

  it('should NOT call onError when either controller is aborted', async () => {
    const onError = rs.fn()
    const controllers = eventListenerPair({
      startTypes: ['start.event'],
      endTypes: ['end.event'],
      startEvent: rs.fn(),
      endEvent: rs.fn(),
      onError,
      ctx: {
        event: {
          subscribe: rs.fn().mockReturnValue((async function* () {
            yield { type: 'start.event', data: {} }
          })()),
        },
      },
    })

    controllers.forEach((c) => c.abort())

    await new Promise((r) => setTimeout(r, 50))

    expect(onError).not.toHaveBeenCalled()
  })

  it('should pass startTypes and endTypes to subscribe separately', async () => {
    const mockCtx = {
      event: {
        subscribe: rs.fn().mockReturnValue((async function* () {})()),
      },
    }

    eventListenerPair({
      startTypes: ['start.event', 'start.event2'],
      endTypes: ['end.event'],
      startEvent: rs.fn(),
      endEvent: rs.fn(),
      onError: rs.fn(),
      ctx: mockCtx,
    })

    expect(mockCtx.event.subscribe).toHaveBeenCalledTimes(2)

    const args1 = mockCtx.event.subscribe.mock.calls[0][0]
    const args2 = mockCtx.event.subscribe.mock.calls[1][0]
    expect(args1.types).toEqual(['start.event', 'start.event2'])
    expect(args2.types).toEqual(['end.event'])
  })
})

describe('defaultErrorEvent', () => {
  beforeEach(() => {
    ;(logError as rs.Mock).mockClear()
  })

  it('should call logError for non-AbortError errors', () => {
    const err = new Error('something went wrong')

    defaultErrorEvent(err)

    expect(logError).toHaveBeenCalledWith(
      'Error in event listener',
      err,
    )
  })

  it('should NOT call logError for AbortError', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'

    defaultErrorEvent(err)

    expect(logError).not.toHaveBeenCalled()
  })

  it('should call logError for null or undefined (they are not AbortError)', () => {
    defaultErrorEvent(null)
    defaultErrorEvent(undefined)

    expect(logError).toHaveBeenCalledTimes(2)
    expect(logError).toHaveBeenCalledWith('Error in event listener', null)
    expect(logError).toHaveBeenCalledWith('Error in event listener', undefined)
  })
})
