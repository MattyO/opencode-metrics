import { describe, it, expect, rs } from '@rstest/core'
import { createSpanStore } from '@mock-factories/spanStore'
import { createUtilsLog } from '@mock-factories/utilsLog'
import { createUtilsPlugin } from '@mock-factories/utilsPlugin'
import { createUtilsTracing } from '@mock-factories/utilsTracing'
import { createPluginEventDefinitions } from '@mock-factories/pluginEventDefinitions'
import { createPluginEventPairDefinitions } from '@mock-factories/pluginEventPairDefinitions'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

rs.mock('@store/spanStore', () => ({ spanStore: createSpanStore() }))
rs.mock('@utils/log', () => ({ logError: createUtilsLog().logError }))
rs.mock('@utils/plugin', () => createUtilsPlugin())
rs.mock('@utils/tracing', () => ({ setupProvider: createUtilsTracing().setupProvider }))
rs.mock('@plugin/eventDefinitions', () => createPluginEventDefinitions())
rs.mock('@plugin/eventPairDefinitions', () => createPluginEventPairDefinitions())

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
