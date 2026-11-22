import { findOrCreateSpan, flushProvider} from '@utils/tracing'

export const pairDefinitions= {
    sessions: {
        startTypes: ['session.execution.started'],
        startEvent: (event) => {
            findOrCreateSpan(`session.execution-${event.data.sessionID}`, { sessionId: event.data.sessionID, type: 'ai.session.execution' })
        },
        endTypes: ['session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted'],
        endEvent: (event) => {
            stopSpan(`session.execution-${event.data.sessionID}`)
            flushProvider()
        },
    },
    steps: {
        startTypes: ['session.step.started'],
        startEvent: (event) => {
            const sid = event.data.sessionID as string
            //const parentSpan = getActiveParentSessionSpan(sid)
            findOrCreateSpan(`session.step${sid}`,
                {sessionId: sid, messageId: event.data.assistantMessageID},
                { attributes: {
                    sessionId: sid,
                    type: 'ai.session.execution',
                    agent: event.data.agent,
                    model: event.data.model?.id,
                },
                //links: parentSpan ? [{ context: parentSpan.span.spanContext() }] : [],
            })
        },
        endTypes: ['session.step.ended'],
        endEvent: (event) => {
            const sid = event.data.sessionID as string
            //const parentSpan = getActiveParentSessionSpan(sid)
            findOrCreateSpan(`session.step${sid}`,
                {sessionId: sid, messageId: event.data.assistantMessageID},
                attributes: {
                    sessionId: sid,
                    type: 'ai.session.execution',
                    agent: event.data.agent,
                    model: event.data.model?.id,
                },
                //links: parentSpan ? [{ context: parentSpan.span.spanContext() }] : [],
            })
        },
    },
}
