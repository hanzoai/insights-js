/**
 * Extend Segment with extra Insights JS functionality. Required for things like Recordings and feature flags to work correctly.
 *
 * ### Usage
 *
 *  ```js
 *  // After your standard segment anyalytics install
 *  analytics.load("GOEDfA21zZTtR7clsBuDvmBKAtAdZ6Np");
 *
 *  analytics.ready(() => {
 *    insights.init('<insights-api-key>', {
 *      capture_pageview: false,
 *      segment: window.analytics, // NOTE: Be sure to use window.analytics here!
 *    });
 *    window.analytics.page();
 *  })
 *  ```
 */
import { Insights } from '../insights-core'
import { createLogger } from '../utils/logger'

import { USER_STATE } from '../constants'
import { isFunction } from '@hanzo/insights-core'
import { uuidv7 } from '../uuidv7'

import type { SegmentUser, SegmentAnalytics, SegmentContext, SegmentPlugin } from '@hanzo/insights-types'

// Re-export for backwards compatibility
export type { SegmentUser, SegmentAnalytics, SegmentContext, SegmentPlugin }

const logger = createLogger('[SegmentIntegration]')

const createSegmentIntegration = (insights: Insights): SegmentPlugin => {
    if (!Promise || !Promise.resolve) {
        logger.warn('This browser does not have Promise support, and can not use the segment integration')
    }

    const enrichEvent = (ctx: SegmentContext, eventName: string | undefined) => {
        if (!eventName) {
            return ctx
        }
        if (!ctx.event.userId && ctx.event.anonymousId !== insights.get_distinct_id()) {
            // This is our only way of detecting that segment's analytics.reset() has been called so we also call it
            logger.info('No userId set, resetting Insights')
            insights.reset()
        }
        if (ctx.event.userId && ctx.event.userId !== insights.get_distinct_id()) {
            logger.info('UserId set, identifying with Insights')
            insights.identify(ctx.event.userId)
        }

        const additionalProperties = insights.calculateEventProperties(eventName, ctx.event.properties)
        ctx.event.properties = Object.assign({}, additionalProperties, ctx.event.properties)
        return ctx
    }

    return {
        name: 'Insights JS',
        type: 'enrichment',
        version: '1.0.0',
        isLoaded: () => true,
        // check and early return above
        // eslint-disable-next-line compat/compat
        load: () => Promise.resolve(),
        track: (ctx) => enrichEvent(ctx, ctx.event.event),
        page: (ctx) => enrichEvent(ctx, '$pageview'),
        identify: (ctx) => enrichEvent(ctx, '$identify'),
        screen: (ctx) => enrichEvent(ctx, '$screen'),
    }
}

function setupInsightsFromSegment(insights: Insights, done: () => void) {
    const segment = insights.config.segment
    if (!segment) {
        return done()
    }

    const bootstrapUser = (user: SegmentUser) => {
        // Use segments anonymousId instead
        const getSegmentAnonymousId = () => user.anonymousId() || uuidv7()
        insights.config.get_device_id = getSegmentAnonymousId

        // If a segment user ID exists, set it as the distinct_id
        if (user.id()) {
            insights.register({
                distinct_id: user.id(),
                $device_id: getSegmentAnonymousId(),
            })
            insights.persistence!.set_property(USER_STATE, 'identified')
        }

        done()
    }

    const segmentUser = segment.user()
    if ('then' in segmentUser && isFunction(segmentUser.then)) {
        segmentUser.then(bootstrapUser)
    } else {
        bootstrapUser(segmentUser as SegmentUser)
    }
}

export function setupSegmentIntegration(insights: Insights, done: () => void) {
    const segment = insights.config.segment
    if (!segment) {
        return done()
    }

    setupInsightsFromSegment(insights, () => {
        segment.register(createSegmentIntegration(insights)).then(() => {
            done()
        })
    })
}
