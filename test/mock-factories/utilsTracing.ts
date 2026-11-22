import { rs } from '@rstest/core'

export function createUtilsTracing() {
  return { setupProvider: rs.fn() }
}
