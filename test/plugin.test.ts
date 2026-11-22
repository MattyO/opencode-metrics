import { describe, it, expect, rs } from '@rstest/core'

// ---------------------------------------------------------------------------
// External library mocks — handled by rs.mock
// ---------------------------------------------------------------------------

rs.mock('lodash', () => ({
  flatten: <T>(arr: T[][]): T[] => arr.flat(),
  filter: <T>(arr: T[], fn: (item: T) => boolean): T[] => arr.filter(fn),
  find: <T>(arr: T[], fn: (item: T) => boolean): T | undefined => arr.find(fn),
}))

rs.mock('@store/spanStore', () => ({
  spanStore: {
    use: {
      provider: () => undefined,
      exporter: () => undefined,
    },
    getState: () => ({
      shutdownProvider: rs.fn().mockResolvedValue(undefined),
      spans: [],
      provider: undefined,
      exporter: undefined,
    }),
    initProvider: rs.fn(),
    shutdownProvider: rs.fn().mockResolvedValue(undefined),
    addSpan: rs.fn(),
    removeSpan: rs.fn(),
    clear: rs.fn(),
    replaceProvider: rs.fn().mockResolvedValue(undefined),
  },
}))

// ---------------------------------------------------------------------------
// Local module mocks
// ---------------------------------------------------------------------------

// @utils/log — needed before @utils/plugin and @plugin/* modules that import it
rs.mock('@utils/log', () => ({
  logError: rs.fn(),
}))

// @utils/plugin — exports debug, eventListener, eventListenerPair
rs.mock('@utils/plugin', () => ({
  debug: rs.fn(),
  eventListener: () => ({ abort: rs.fn() }),
  eventListenerPair: () => [{ abort: rs.fn() }],
}))

// @utils/tracing — exports setupProvider
rs.mock('@utils/tracing', () => ({
  setupProvider: rs.fn(),
}))

// @plugin/eventDefinitions — exports sharedEvents, pluginEvents
rs.mock('@plugin/eventDefinitions', () => ({
  sharedEvents: {
    defaultErrorEvent: (err: unknown) => {
      if ((err as Error)?.name !== 'AbortError') {
        console.error(err)
      }
    },
  },
  pluginEvents: {
    inboxDelivered: {
      types: ['session.inbox.delivered'],
      event: () => {},
    },
    debug: {
      types: ['*', '-session.reasoning.delta', '-session.text.delta', '-session.compaction.delta'],
      event: () => {},
    },
  },
}))

// @plugin/eventPairDefinitions — exports pairDefinitions
rs.mock('@plugin/eventPairDefinitions', () => ({
  pairDefinitions: {
    sessions: {
      startTypes: ['session.execution.started'],
      startEvent: () => {},
      endTypes: ['session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted'],
      endEvent: () => {},
    },
    steps: {
      startTypes: ['session.step.started'],
      startEvent: () => {},
      endTypes: ['session.step.ended'],
      endEvent: () => {},
    },
  },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('plugin/opencode-tracing', () => {
  it('should return undefined when disabled', async () => {
    const mod = await import('@plugin/index')
    const plugin = mod.default as any
    const ctx = { options: { enabled: false } }

    const result = await plugin.setup(ctx)

    expect(result).toBeUndefined()
  })

  it('should return a cleanup function when enabled', async () => {
    const mod = await import('@plugin/index')
    const plugin = mod.default as any
    const ctx = { options: { enabled: true } }

    const result = await plugin.setup(ctx)

    expect(result).toBeInstanceOf(Function)
  })
})
