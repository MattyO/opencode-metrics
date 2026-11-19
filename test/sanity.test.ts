import { describe, it, expect } from '@rstest/core'

describe('arithmetic', () => {
  it('should add 2 + 2', () => {
    expect(2 + 2).toBe(4)
  })

  it('should subtract 5 - 3', () => {
    expect(5 - 3).toBe(2)
  })
})
