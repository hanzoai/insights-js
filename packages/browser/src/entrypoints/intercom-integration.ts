import { Insights } from '../insights-core'
import { assignableWindow } from '../utils/globals'
import { createLogger } from '../utils/logger'

const logger = createLogger('[Insights Intercom integration]')

const reportedSessionIds = new Set<string>()
let sessionIdListenerUnsubscribe: undefined | (() => void) = undefined

assignableWindow.__InsightsExtensions__ = assignableWindow.__InsightsExtensions__ || {}
assignableWindow.__InsightsExtensions__.integrations = assignableWindow.__InsightsExtensions__.integrations || {}
assignableWindow.__InsightsExtensions__.integrations.intercom = {
    start: (insights: Insights) => {
        if (!insights.config.integrations?.intercom) {
            return
        }

        const intercom = (assignableWindow as any).Intercom
        if (!intercom) {
            logger.warn('Intercom not found while initializing the integration')
            return
        }

        const updateIntercom = () => {
            const replayUrl = insights.get_session_replay_url()
            const personUrl = insights.requestRouter.endpointFor(
                'ui',
                `/project/${insights.config.token}/person/${insights.get_distinct_id()}`
            )

            intercom('update', {
                latestInsightsReplayURL: replayUrl,
                latestInsightsPersonURL: personUrl,
            })
            intercom('trackEvent', 'insights:sessionInfo', { replayUrl, personUrl })
        }

        // this is called immediately if there's a session id
        // and then again whenever the session id changes
        sessionIdListenerUnsubscribe = insights.onSessionId((sessionId) => {
            if (!reportedSessionIds.has(sessionId)) {
                updateIntercom()
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
