import {ALL_EVENTS, SHOW_FULL_DATA} from '@/plugin/constants'

import {eventDefinitions} from '@/plugin/eventDefinitions'
export const eventDefinitions: {
    inboxDelivered:{
        types: ['session.inbox.delivered'],
        event: (event) => {
          const span = getActiveParentSessionSpan(event.data.sessionID as string)
          if (span) {
            span.span.setAttribute('msgId', event.data.inboxID as string)
          }
        },
    },
    debug: {
        types: ['*', '-session.reasoning.delta', '-session.text.delta', '-session.compaction.delta'],
        event: (event) => {
          debug(`[opencode-tracing] EVENT type=${event.type}`)
          if (new Set(SHOW_FULL_DATA).has(event.type)) {
            debug(`[opencode-tracing] ${event.type} EVENT data=${inspect(event, { depth: 3, colors: true })}`)
          }
        },
    }

}
