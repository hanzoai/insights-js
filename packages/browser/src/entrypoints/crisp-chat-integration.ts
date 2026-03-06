import { Insights } from '../insights-core'
import { assignableWindow } from '../utils/globals'
import { createLogger } from '../utils/logger'

const logger = createLogger('[Insights Crisp Chat]')

const reportedSessionIds = new Set<string>()
let sessionIdListenerUnsubscribe: undefined | (() => void) = undefined

assignableWindow.__InsightsExtensions__ = assignableWindow.__InsightsExtensions__ || {}
assignableWindow.__InsightsExtensions__.integrations = assignableWindow.__InsightsExtensions__.integrations || {}
assignableWindow.__InsightsExtensions__.integrations.crispChat = {
    start: (insights: Insights) => {
        if (!insights.config.integrations?.crispChat) {
            return
        }

        const crispChat = (assignableWindow as any).$crisp
        if (!crispChat) {
            logger.warn('Crisp Chat not found while initializing the integration')
            return
        }

        const updateCrispChat = () => {
            const replayUrl = insights.get_session_replay_url()
            const personUrl = insights.requestRouter.endpointFor(
                'ui',
                `/project/${insights.config.token}/person/${insights.get_distinct_id()}`
            )

            crispChat.push([
                'set',
                'session:data',
                [
                    [
                        ['insightsSessionURL', replayUrl],
                        ['insightsPersonURL', personUrl],
                    ],
                ],
            ])
        }

        // this is called immediately if there's a session id
        // and then again whenever the session id changes
        sessionIdListenerUnsubscribe = insights.onSessionId((sessionId) => {
            if (!reportedSessionIds.has(sessionId)) {
                updateCrispChat()
                reportedSessionIds.add(sessionId)
            }
        })

        logger.info('integration started')
    },
    stop: () => {
        sessionIdListenerUnsubscribe?.()
        sessionIdListenerUnsubscribe = undefined
    },
}
