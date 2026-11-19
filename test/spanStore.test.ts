import { describe, it, expect } from '@rstest/core'
import { useSpanStore } from '@/store/spanStore'

describe('SpanStore', () => {
  it('should start with an empty spans array', () => {
    const store = useSpanStore.getState()
    expect(store.spans).toEqual([])
  })
})
