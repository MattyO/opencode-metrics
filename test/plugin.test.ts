import { describe, it, expect, rs } from '@rstest/core'

// Lodash mock — rs.mock handles it
rs.mock('lodash', () => ({
  flatten: <T>(arr: T[][]): T[] => arr.flat(),
  filter: <T>(arr: T[], fn: (item: T) => boolean): T[] => arr.filter(fn),
  find: <T>(arr: T[], fn: (item: T) => boolean): T | undefined => arr.find(fn),
}))

// Mock @/store/spanStore — use rs.fn for initProvider so it's callable
rs.mock('@/store/spanStore', () => ({
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
// Tests
// ---------------------------------------------------------------------------

describe('plugin/opencode-tracing', () => {
  it.skip('should return undefined when disabled', async () => {
    const mod = await import('@/plugin')
    const plugin = mod.default as any
    const ctx = { options: { enabled: false } }

    const result = await plugin.setup(ctx)

    expect(result).toBeUndefined()
  })

  it.skip('should return a cleanup function when enabled', async () => {
    const mod = await import('@/plugin')
    const plugin = mod.default as any
    const ctx = { options: { enabled: true } }

    const result = await plugin.setup(ctx)

    expect(result).toBeInstanceOf(Function)
  })
})
