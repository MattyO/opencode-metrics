import { findOrCreateSpan, flushProvider, endSpan } from '@utils/tracing'

export const pairDefinitions= {
    sessions: {
        startTypes: ['session.execution.started'],
        startEvent: (event) => {
            findOrCreateSpan(`session.execution-${event.data.sessionID}`, { sessionId: event.data.sessionID, type: 'ai.session.execution' })
        },
        endTypes: ['session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted'],
        endEvent: (event) => {
            endSpan(`session.execution-${event.data.sessionID}`)
            flushProvider()
        },
    },
    steps: {
        startTypes: ['session.step.started'],
        startEvent: (event) => {
            const sid = event.data.sessionID as string
            const lookupInfo =  {
                sessionId: sid,
                messageId: event.data.assistantMessageID,
                type: 'ai.session.step'
            },
            //const parentSpan = getActiveParentSessionSpan(sid)
            findOrCreateSpan(`session.step`,
                lookupInfo
                { attributes: {
                    sessionId: sid,
                    messageId: "event.data.assistantMessageID",
                    type: 'ai.session.step',
                    agent: event.data.agent,
                    model: event.data.model?.id,
                },
                //links: parentSpan ? [{ context: parentSpan.span.spanContext() }] : [],
            })
        },
        endTypes: ['session.step.ended'],
        endEvent: (event) => {
            const sid = event.data.sessionID as string
            const lookupInfo =  {
                sessionId: sid,
                messageId: event.data.assistantMessageID,
                type: 'ai.session.step'
            },

            //const parentSpan = getActiveParentSessionSpan(sid)
            findOrCreateSpan(`session.step`,
                lookupInfo
                { attributes: {
                    sessionId: sid,
                    type: 'ai.session.execution',
                    agent: event.data.agent,
                    model: event.data.model?.id,
                },
                //links: parentSpan ? [{ context: parentSpan.span.spanContext() }] : [],
            })
            endSpan(`session.step`, lookupInfo)
            flushProvider()
        },
    },
}
