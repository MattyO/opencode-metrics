import { rs } from '@rstest/core'

export function createSpanStore() {
  return {
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
  }
}
