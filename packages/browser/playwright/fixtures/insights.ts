import { TestInfo } from '@playwright/test'
import { CaptureResult, InsightsConfig } from '@/types'
import { Insights } from '@/insights-core'
import { EventsPage, testEvents } from './events'
import { BasePage } from './page'

export const testInsights = testEvents.extend<{
    insights: InsightsPage
    insightsOptions: Partial<InsightsConfig>
}>({
    insightsOptions: [{ request_batching: false }, { option: true }],
    insights: async ({ page, events, insightsOptions }, use, testInfo) => {
        const insightsPage = new InsightsPage(insightsOptions, page, events, testInfo)
        await use(insightsPage)
    },
})

const currentEnv = process.env
const {
    INSIGHTS_PROJECT_API_KEY = 'public_key',
    INSIGHTS_API_HOST = 'http://localhost:2345',
    BRANCH_NAME,
    RUN_ID,
    BROWSER,
} = currentEnv

export type WindowWithInsights = typeof globalThis & {
    insights?: Insights
    capturedEvents?: CaptureResult[]
    [key: string]: any
}

export class InsightsPage {
    testSessionId: string

    constructor(
        private baseOptions: Partial<InsightsConfig>,
        private page: BasePage,
        private events: EventsPage,
        private testInfos: TestInfo
    ) {
        this.testSessionId = Math.random().toString(36).substring(2, 15)
    }

    getTestSessionId() {
        return this.testSessionId
    }

    getTestTitle() {
        return this.testInfos.title
    }

    private getHandle() {
        return this.page.evaluateHandle(() => {
            const instance = (window as WindowWithInsights).insights
            if (!instance) {
                throw new Error('Insights instance not found')
            }
            return instance
        })
    }

    async evaluate<T, U>(fn: (insights: Insights, args: T) => U, args?: T): Promise<U> {
        const handle = await this.getHandle()
        return await handle.evaluate(fn as any, args)
    }

    async waitForLoaded() {
        await this.page.waitForFunction(() => {
            return (window as WindowWithInsights).insights?.__loaded ?? false
        })
    }

    async init(
        initOptions: Partial<Omit<InsightsConfig, 'before_send' | 'loaded'>> = {},
        beforeSendHandles: string[] = []
    ) {
        const additionalProperties = {
            testSessionId: this.getTestSessionId(),
            testName: this.testInfos.title,
            testBranchName: BRANCH_NAME,
            testRunId: RUN_ID,
            testBrowser: BROWSER,
        }
        const storeHandle = await this.page.createFunctionHandle((evt: CaptureResult) => {
            this.events.addEvent(evt)
        })
        await this.page.evaluate((storeHandle) => {
            ;(window as WindowWithInsights)['last_before_send'] = (evt: CaptureResult) => {
                ;(window as WindowWithInsights)[storeHandle](evt)
                return evt
            }
        }, storeHandle)
        await this.evaluate(
            // TS very unhappy with passing InsightsConfig here, so just pass an object
            (ph: Insights, args: Record<string, any>) => {
                const insightsConfig: Partial<InsightsConfig> = {
                    api_host: args.apiHost,
                    debug: true,
                    ip: false, // Prevent IP deprecation warning in Playwright tests
                    ...args.options,
                    before_send: args.beforeSendHandles.map((h: any) => window[h]),
                    loaded: (ph) => {
                        if (ph.sessionRecording) {
                            ph.sessionRecording._forceAllowLocalhostNetworkCapture = true
                        }
                        ph.register(args.additionalProperties)
                        // playwright can't serialize functions to pass around from the playwright to browser context
                        // if we want to run custom code in the loaded function we need to pass it on the page's window,
                        // but it's a new window so we have to create it in the `before_insights_init` option
                        ;(window as any).__ph_loaded?.(ph)
                    },
                    opt_out_useragent_filter: true,
                }
                ph.init(args.token, insightsConfig)
            },
            {
                token: INSIGHTS_PROJECT_API_KEY,
                apiHost: INSIGHTS_API_HOST,
                options: {
                    ...this.baseOptions,
                    ...initOptions,
                },
                beforeSendHandles: [...beforeSendHandles, 'last_before_send'],
                additionalProperties,
            } as Record<string, any>
        )
        await this.page.waitForLoadState('networkidle')
    }

    async capture(eventName: string, properties?: Record<string, any>) {
        await this.evaluate(
            (ph, args: { eventName: string; properties?: Record<string, any> }) => {
                ph.capture(args.eventName, args.properties)
            },
            { eventName, properties }
        )
    }

    async register(records: Record<string, string>) {
        await this.page.evaluate(
            // TS very unhappy with passing InsightsConfig here, so just pass an object
            (args: Record<string, any>) => {
                const windowInsights = (window as WindowWithInsights).insights
                windowInsights?.register(args)
            },
            records
        )
    }
}
