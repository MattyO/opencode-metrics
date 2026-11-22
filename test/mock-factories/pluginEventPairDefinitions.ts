export function createPluginEventPairDefinitions() {
  return {
    pairDefinitions: {
      sessions: {
        startTypes: ['session.execution.started'],
        startEvent: () => {},
        endTypes: [
          'session.execution.succeeded',
          'session.execution.failed',
          'session.execution.interrupted',
        ],
        endEvent: () => {},
      },
      steps: {
        startTypes: ['session.step.started'],
        startEvent: () => {},
        endTypes: ['session.step.ended'],
        endEvent: () => {},
      },
    },
  }
}
