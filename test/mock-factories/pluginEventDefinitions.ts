export function createPluginEventDefinitions() {
  return {
    sharedEvents: {
      defaultErrorEvent: (err: unknown) => {
        if ((err as Error)?.name !== 'AbortError') {
          console.error(err)
        }
      },
    },
    pluginEvents: {
      inboxDelivered: {
        types: ['session.inbox.delivered'],
        event: () => {},
      },
      debug: {
        types: ['*', '-session.reasoning.delta', '-session.text.delta', '-session.compaction.delta'],
        event: () => {},
      },
    },
  }
}
