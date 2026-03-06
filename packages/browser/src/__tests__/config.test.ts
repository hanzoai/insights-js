import { Insights } from '../insights-core'
import type { InsightsConfig } from '../types'
import { isFunction } from '@hanzo/insights-core'

describe('config', () => {
    describe('compatibilityDate', () => {
        it('should set capture_pageview to true when defaults is undefined', () => {
            const insights = new Insights()
            insights._init('test-token')
            expect(insights.config.capture_pageview).toBe(true)
        })

        it('should set expected values when defaults is 2025-05-24', () => {
            const insights = new Insights()
            insights._init('test-token', { defaults: '2025-05-24' })
            expect(insights.config.capture_pageview).toBe('history_change')
            expect(insights.config.session_recording).toStrictEqual({})
            expect(insights.config.rageclick).toBe(true)
        })

        it('should set expected values when defaults is 2025-11', () => {
            const insights = new Insights()
            insights._init('test-token', { defaults: '2025-11-30' })
            expect(insights.config.capture_pageview).toBe('history_change')
            expect(insights.config.session_recording.strictMinimumDuration).toBe(true)
            expect(insights.config.rageclick).toStrictEqual({ content_ignorelist: true })
        })

        it('should preserve other default config values when setting defaults', () => {
            const insights1 = new Insights()
            insights1._init('test-token')
            const config1 = { ...insights1.config }

            const insights2 = new Insights()
            insights2._init('test-token', { defaults: '2025-05-24' })
            const config2 = insights2.config

            // Check that all other config values remain the same
            const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)])
            allKeys.forEach((key) => {
                if (!['capture_pageview', 'defaults'].includes(key)) {
                    const val1 = config1[key as keyof InsightsConfig]
                    const val2 = config2[key as keyof InsightsConfig]
                    if (isFunction(val1)) {
                        expect(isFunction(val2)).toBe(true)
                    } else {
                        expect(val2).toEqual(val1)
                    }
                }
            })
        })
    })
})
