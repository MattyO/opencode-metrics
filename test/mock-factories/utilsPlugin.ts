import { rs } from '@rstest/core'

export function createUtilsPlugin() {
  return {
    debug: rs.fn(),
    eventListener: () => ({ abort: rs.fn() }),
    eventListenerPair: () => [{ abort: rs.fn() }],
  }
}
