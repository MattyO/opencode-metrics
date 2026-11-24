import { findOrCreateSpan, flushProvider, endSpan, getActiveParentSessionSpan } from '@utils/tracing'
import { debug } from '@utils/plugin'
import {spanStore} from '@store/spanStore'

export const pairDefinitions= {
    sessions: {
        startTypes: ['session.execution.started'],
        startEvent: (event) => {
            debug(`[opencode-tracing] start: session.execution.started, sessionID=${event.data.sessionID}`)
            const lookupInfo = { sessionId: event.data.sessionID, type: 'ai.session.execution' }
            findOrCreateSpan(`session.execution`, lookupInfo, lookupInfo )
        },
        endTypes: ['session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted'],
        endEvent: (event) => {
            debug(`[opencode-tracing] end: ${event.type}, sessionID=${event.data.sessionID}`)
            const lookupInfo = { sessionId: event.data.sessionID, type: 'ai.session.execution' }
            endSpan(`session.execution`, lookupInfo )
            flushProvider()
        },
    },
    steps: {
        startTypes: ['session.step.started'],
        startEvent: (event) => {
            debug(`[opencode-tracing] start: session.step.started, sessionID=${event.data.sessionID}`)
            const sid = event.data.sessionID as string

            const lookupInfo =  {
                sessionId: sid,
                messageId: event.data.assistantMessageID,
                type: 'ai.session.step'
            }
            debug(lookupInfo)
            const parentSpan = getActiveParentSessionSpan(sid)
            findOrCreateSpan(`session.step`,
                lookupInfo,
                { attributes: {
                    sessionId: sid,
                    messageId: event.data.assistantMessageID,
                    type: 'ai.session.step',
                    agent: event.data.agent,
                    model: event.data.model?.id,
                },
                links: parentSpan ? [{ context: parentSpan.span.spanContext() }] : [],
            })

            debug(`${spanStore.getState()}`)
        },
        endTypes: ['session.step.ended'],
        endEvent: (event) => {
            debug(`[opencode-tracing] end: session.step.ended, sessionID=${event.data.sessionID}`)
            const sid = event.data.sessionID as string
            const lookupInfo =  {
                sessionId: sid,
                messageId: event.data.assistantMessageID,
                type: 'ai.session.step'
            }
            endSpan(`session.step`, lookupInfo)
            flushProvider()
        },
    },
    reasoning: {
        startTypes: ['session.reasoning.started'],
        startEvent: (event) => {
            debug(`[opencode-tracing] start: session.reasoning.started, sessionID=${event.data.sessionID}, msgID=${event.data.assistantMessageID}`)
            const lookupInfo =  {
                sessionId: event.data.sessionID,
                messageId: event.data.assistantMessageID,
                type: 'ai.reasoning'
            }
            findOrCreateSpan(`session.reasoning`,
                lookupInfo,
                { attributes: lookupInfo }
            )
        },
        endTypes: ['session.reasoning.ended'],
        endEvent: (event) => {
            const lookupInfo =  {
                sessionId: event.data.sessionID,
                messageId: event.data.assistantMessageID,
                type: 'ai.reasoning'
            }
            endSpan(`session.reasoning`, lookupInfo)
            flushProvider()
        },
    },
    tool: {
        startTypes: ['session.tool.called'],
        startEvent: (event) => {
            debug(`[opencode-tracing] start: session.tool.called, sessionID=${event.data.sessionID}, msgID=${event.data.assistantMessageID}`)
            const lookupInfo =  {
                sessionId: event.data.sessionID,
                messageId: event.data.assistantMessageID,
                type: 'ai.calls.tool'
            }
            findOrCreateSpan(`session.tool`,
                lookupInfo,
                { attributes: { command: event.data.input.command } }
            )
        },
        endTypes: ['session.tool.success','session.tool.failed',],
        endEvent: (event) => {
            const lookupInfo =  {
                sessionId: event.data.sessionID,
                messageId: event.data.assistantMessageID,
                type: 'ai.calls.tool'
            }
            endSpan(`session.tool`, lookupInfo)
            flushProvider()
        },
    },
    compaction: {
        startTypes: ['session.compaction.started'],
        startEvent: (event) => {
            debug(`[opencode-tracing] start: session.compaction.started, sessionID=${event.data.sessionID}`)
            const lookupInfo =  {
                sessionId: event.data.sessionID,
                type: 'ai.compaction'
            }
            findOrCreateSpan(`session.compaction`,
                lookupInfo,
                { attributes: lookupInfo }
            )
        },
        endTypes: ['session.compaction.ended'],
        endEvent: (event) => {
            const lookupInfo =  {
                sessionId: event.data.sessionID,
                type: 'ai.compaction'
            }
            endSpan(`session.compaction`, lookupInfo)
            flushProvider()
        },
    },

}
