import { describe, it, expect, rs } from '@rstest/core'
import { eventListener } from '@/utils/plugin'
import { asyncGeneratorMock, withTimeout} from '@testHelpers/testHelpers'

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

    //await stopExecution()

    await withTimeout( stopExecution(), 5000)
    expect(onEvent).toHaveBeenCalledTimes(2)

     //let wascalled = false
     //await withTimeout( onEmpty( ()=> {
     //     expect(onEvent).toHaveBeenCalledTimes(2)
     // }), 5000)
     // expect(onEvent).toHaveBeenCalledTimes(2)


  })
})
