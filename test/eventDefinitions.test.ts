import { describe, it, expect } from '@rstest/core'
import { pluginEvents, sharedEvents } from '@plugin/eventDefinitions'

// ---------------------------------------------------------------------------
// pluginEvents
// ---------------------------------------------------------------------------

describe('pluginEvents', () => {
  describe('inboxDelivered', () => {
    it('should define expected types', () => {
      expect(pluginEvents.inboxDelivered.types).toEqual(['session.inbox.delivered'])
    })

    it('should run the event function', () => {
      const mockEvent = {
        type: 'session.inbox.delivered',
        data: {
          sessionID: 'test-session',
          inboxID: 'inbox-1',
        },
      }
      // Should not throw
      expect(() => pluginEvents.inboxDelivered.event(mockEvent)).not.toThrow()
    })
  })

  describe('debug', () => {
    it('should define expected types', () => {
      expect(pluginEvents.debug.types).toEqual([
        '*',
        '-session.reasoning.delta',
        '-session.text.delta',
        '-session.compaction.delta',
      ])
    })

    it('should run the event function', () => {
      const mockEvent = {
        type: 'session.execution.started',
        data: {},
      }
      // Should not throw
      expect(() => pluginEvents.debug.event(mockEvent)).not.toThrow()
    })
  })
})

// ---------------------------------------------------------------------------
// sharedEvents
// ---------------------------------------------------------------------------

describe('sharedEvents', () => {
  describe('defaultErrorEvent', () => {
    it('should be a function', () => {
      expect(typeof sharedEvents.defaultErrorEvent).toBe('function')
    })

    it('should run the event function without throwing for non-abort errors', () => {
      const mockError = new Error('test error')
      // Should not throw
      expect(() => sharedEvents.defaultErrorEvent(mockError)).not.toThrow()
    })
  })
})
