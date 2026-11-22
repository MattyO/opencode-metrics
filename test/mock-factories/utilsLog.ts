import { rs } from '@rstest/core'

export function createUtilsLog() {
  return { logError: rs.fn() }
}
