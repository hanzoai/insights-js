import './helpers/mock-logger'

import { Insights } from '../insights-core'
import { defaultInsights } from './helpers/insights-instance'
import { uuidv7 } from '../uuidv7'
import { InsightsConfig } from '../types'
import { navigator } from '../utils/globals'

describe('bot detection and pageview collection', () => {
    let insights: Insights
    let beforeSendMock: jest.Mock
    let originalUserAgent: string

    const createInsights = async (config: Partial<InsightsConfig> = {}) => {
        beforeSendMock = jest.fn().mockImplementation((e) => e)
        const insights = await new Promise<Insights>(
            (resolve) =>
                defaultInsights().init(
                    'testtoken',
                    {
                        capture_pageview: false, // Disable auto-capture to avoid race conditions
                        before_send: beforeSendMock,
                        ...config,
                        loaded: (insights) => resolve(insights),
                    },
                    uuidv7()
                )!
        )
        insights.debug()
        return insights
    }

    beforeEach(async () => {
        // Store original user agent
        originalUserAgent = navigator!.userAgent
    })

    afterEach(() => {
        // Restore original user agent
        Object.defineProperty(navigator, 'userAgent', {
            value: originalUserAgent,
            configurable: true,
        })
        Object.defineProperty(navigator, 'webdriver', {
            value: undefined,
            configurable: true,
        })
    })

    const setBotUserAgent = (botUA: string) => {
        Object.defineProperty(navigator, 'userAgent', {
            value: botUA,
            configurable: true,
        })
    }

    const setWebdriver = (value: boolean) => {
        Object.defineProperty(navigator, 'webdriver', {
            value: value,
            configurable: true,
        })
    }

    describe('default behavior (without preview flag)', () => {
        it('should drop pageview events from bots', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
            insights = await createInsights()

            insights.capture('$pageview')

            expect(beforeSendMock).not.toHaveBeenCalled()
        })

        it('should drop all events from bots, not just pageviews', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')
            insights = await createInsights()

            insights.capture('custom_event')

            expect(beforeSendMock).not.toHaveBeenCalled()
        })

        it('should drop events from webdriver-detected bots', async () => {
            setWebdriver(true)
            insights = await createInsights()

            insights.capture('$pageview')

            expect(beforeSendMock).not.toHaveBeenCalled()
        })

        it('should allow events from normal browsers', async () => {
            setBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
            insights = await createInsights()

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$pageview')
            const properties = beforeSendMock.mock.calls[0][0].properties
            expect(properties.$browser_type).toBeUndefined()
        })
    })

    describe('with opt_out_useragent_filter enabled', () => {
        it('should allow all events from bots when opt_out_useragent_filter is true', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
            insights = await createInsights({ opt_out_useragent_filter: true })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$pageview')
        })

        it('should add $browser_type property when opt_out_useragent_filter is true', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
            insights = await createInsights({ opt_out_useragent_filter: true })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            const properties = beforeSendMock.mock.calls[0][0].properties
            expect(properties.$browser_type).toBe('bot')
        })

        it('should set $browser_type to "browser" for non-bots when opt_out_useragent_filter is true', async () => {
            setBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
            insights = await createInsights({ opt_out_useragent_filter: true })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            const properties = beforeSendMock.mock.calls[0][0].properties
            expect(properties.$browser_type).toBe('browser')
        })
    })

    describe('with __preview_capture_bot_pageviews enabled', () => {
        it('should send bot pageviews as $bot_pageview events', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
            insights = await createInsights({ __preview_capture_bot_pageviews: true })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$bot_pageview')
            const properties = beforeSendMock.mock.calls[0][0].properties
            // While it's obvious that a $bot_pageview is from a bot, we explicitly set $browser_type
            // to make it easy to filter and test bot pageviews in the product
            expect(properties.$browser_type).toBe('bot')
        })

        it('should send non-pageview events from bots with original event name', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')
            insights = await createInsights({ __preview_capture_bot_pageviews: true })

            insights.capture('custom_event')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('custom_event')
        })

        it('should send webdriver-detected bot pageviews as $bot_pageview', async () => {
            setWebdriver(true)
            insights = await createInsights({ __preview_capture_bot_pageviews: true })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$bot_pageview')
        })

        it('should send normal browser pageviews as $pageview', async () => {
            setBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
            insights = await createInsights({ __preview_capture_bot_pageviews: true })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$pageview')
        })

        it('should work with various bot user agents', async () => {
            const botUserAgents = [
                'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'facebookexternalagent',
                'Twitterbot/1.0',
                'LinkedInBot/1.0',
                'Chrome-Lighthouse',
                'HeadlessChrome/91.0.4472.124',
            ]

            for (const ua of botUserAgents) {
                setBotUserAgent(ua)
                insights = await createInsights({ __preview_capture_bot_pageviews: true })
                beforeSendMock.mockClear()

                insights.capture('$pageview')

                expect(beforeSendMock).toHaveBeenCalled()
                expect(beforeSendMock.mock.calls[0][0].event).toBe('$bot_pageview')
            }
        })
    })

    describe('interaction between opt_out_useragent_filter and __preview_capture_bot_pageviews', () => {
        it('should not rename events when opt_out_useragent_filter is true (bot filtering disabled)', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
            insights = await createInsights({
                opt_out_useragent_filter: true,
                __preview_capture_bot_pageviews: true,
            })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            // Should be $pageview, not $bot_pageview, because opt_out_useragent_filter disables bot detection
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$pageview')
        })

        it('should still set $browser_type when opt_out_useragent_filter is true', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
            insights = await createInsights({
                opt_out_useragent_filter: true,
                __preview_capture_bot_pageviews: true,
            })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            const properties = beforeSendMock.mock.calls[0][0].properties
            expect(properties.$browser_type).toBe('bot')
        })

        it('should allow bot events when opt_out_useragent_filter is true even without preview flag', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
            insights = await createInsights({
                opt_out_useragent_filter: true,
                __preview_capture_bot_pageviews: false,
            })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$pageview')
            const properties = beforeSendMock.mock.calls[0][0].properties
            expect(properties.$browser_type).toBe('bot')
        })

        it('should keep original event names for non-pageview bot events when both flags are true', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
            insights = await createInsights({
                opt_out_useragent_filter: true,
                __preview_capture_bot_pageviews: true,
            })

            insights.capture('custom_event')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('custom_event')
            const properties = beforeSendMock.mock.calls[0][0].properties
            expect(properties.$browser_type).toBe('bot')
        })
    })

    describe('edge cases', () => {
        it('should handle missing navigator gracefully', async () => {
            const originalNav = (global as any).navigator
            ;(global as any).navigator = undefined

            insights = await createInsights({ __preview_capture_bot_pageviews: true })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$pageview')
            ;(global as any).navigator = originalNav
        })

        it('should handle custom blocked user agents', async () => {
            setBotUserAgent('MyCustomBot/1.0')
            insights = await createInsights({
                custom_blocked_useragents: ['MyCustomBot'],
                __preview_capture_bot_pageviews: true,
            })

            insights.capture('$pageview')

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$bot_pageview')
        })

        it('should preserve event properties when renaming to $bot_pageview', async () => {
            setBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
            insights = await createInsights({ __preview_capture_bot_pageviews: true })

            insights.capture('$pageview', { custom_prop: 'test_value' })

            expect(beforeSendMock).toHaveBeenCalled()
            expect(beforeSendMock.mock.calls[0][0].event).toBe('$bot_pageview')
            const properties = beforeSendMock.mock.calls[0][0].properties
            expect(properties.custom_prop).toBe('test_value')
        })
    })
})
