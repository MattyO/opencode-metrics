import { describe, it, expect, rs } from '@rstest/core'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

rs.mock('@utils/log', () => ({
  logError: rs.fn(),
}))

rs.mock('@utils/plugin', () => ({
  debug: rs.fn(),
  eventListener: () => ({ abort: rs.fn() }),
  eventListenerPair: () => [{ abort: rs.fn() }],
}))

rs.mock('@utils/tracing', () => ({
  setupProvider: rs.fn(),
}))

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

rs.mock('@plugin/eventPairDefinitions', () => ({
  pairDefinitions: {
    sessions: {
      startTypes: ['session.execution.started'],
      startEvent: () => {},
      endTypes: [
        'session.execution.succeeded',
        'session.execution.failed',
        'session.execution.interrupted',
      ],
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
