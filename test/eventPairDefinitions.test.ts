import { describe, it, expect } from '@rstest/core'
import { pairDefinitions } from '@plugin/eventPairDefinitions'

// ---------------------------------------------------------------------------
// pairDefinitions
// ---------------------------------------------------------------------------

describe('pairDefinitions', () => {
  describe('sessions', () => {
    it('should define expected startTypes', () => {
      expect(pairDefinitions.sessions.startTypes).toEqual(['session.execution.started'])
    })

    it('should define expected endTypes', () => {
      expect(pairDefinitions.sessions.endTypes).toEqual([
        'session.execution.succeeded',
        'session.execution.failed',
        'session.execution.interrupted',
      ])
    })

    it('should run the startEvent function', () => {
      const mockEvent = {
        type: 'session.execution.started',
        data: {
          sessionID: 'test-session',
        },
      }
      expect(() => pairDefinitions.sessions.startEvent(mockEvent)).not.toThrow()
    })

    it('should run the endEvent function', () => {
      const mockEvent = {
        type: 'session.execution.succeeded',
        data: {
          sessionID: 'test-session',
        },
      }
      expect(() => pairDefinitions.sessions.endEvent(mockEvent)).not.toThrow()
    })
  })

  describe('steps', () => {
    it('should define expected startTypes', () => {
      expect(pairDefinitions.steps.startTypes).toEqual(['session.step.started'])
    })

    it('should define expected endTypes', () => {
      expect(pairDefinitions.steps.endTypes).toEqual(['session.step.ended'])
    })

    it('should run the startEvent function', () => {
      const mockEvent = {
        type: 'session.step.started',
        data: {
          sessionID: 'test-session',
          assistantMessageID: 'msg-1',
          agent: 'test-agent',
          model: { id: 'test-model' },
        },
      }
      expect(() => pairDefinitions.steps.startEvent(mockEvent)).not.toThrow()
    })

    it('should run the endEvent function', () => {
      const mockEvent = {
        type: 'session.step.ended',
        data: {
          sessionID: 'test-session',
          assistantMessageID: 'msg-1',
          agent: 'test-agent',
          model: { id: 'test-model' },
        },
      }
      expect(() => pairDefinitions.steps.endEvent(mockEvent)).not.toThrow()
    })
  })
})
