import { describe, it, expect } from '@rstest/core'
import { spanStore } from '@/store/spanStore'

describe('SpanStore', () => {
  it('should start with an empty spans array', () => {
    expect(spanStore.getState().spans).toEqual([])
  })
})
