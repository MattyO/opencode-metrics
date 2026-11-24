import {ALL_EVENTS, SHOW_FULL_DATA} from '@plugin/constants'
import { debug, logError } from '@utils/log'
import { inspect } from 'util'

import { getActiveParentSessionSpan } from '@utils/tracing'

export const pluginEvents: Record<string, {
  types: string[]
  event: (event: any) => void
}> = {
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
            //debug(`[opencode-tracing] ${event.type} EVENT data=${inspect(event, { depth: 3, colors: true })}`)
          }
        },
    }
}

export const sharedEvents = {
  defaultErrorEvent: (err: unknown): void => {
    if ((err as Error)?.name !== 'AbortError') {
      logError('Error in event listener', err)
    }
  },
}
