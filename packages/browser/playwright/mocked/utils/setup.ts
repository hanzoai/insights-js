import { Page, BrowserContext } from '@playwright/test'
import { Compression, FlagsResponse, InsightsConfig } from '@/types'
import path from 'path'
import { WindowWithInsights } from './insights-playwright-test-base'

/**
 * uses the standard playwright page.goto
 * but if the URL starts with './'
 * treats it as a relative file path
 *
 */
export async function gotoPage(page: Page, url: string) {
    // Visit the specified URL
    if (url.startsWith('./')) {
        const filePath = path.resolve(process.cwd(), url)
        // starts with a single slash since otherwise we get three
        url = `file://${filePath}`
    }
    await page.goto(url)
}

export interface StartOptions {
    waitForFlags?: boolean
    initInsights?: boolean
    resetOnInit?: boolean
    // playwright is stricter than cypress on access to the window object
    // sometimes you need to pass functions here that will run on window in the correct page
    runBeforeInsightsInit?: (pg: Page) => void
    // playwright is stricter than cypress on access to the window object
    // sometimes you need to pass functions here that will run on window in the correct page
    runAfterInsightsInit?: (pg: Page) => void
    type?: 'navigate' | 'reload'
    options?: Partial<InsightsConfig>
    flagsResponseOverrides?: Partial<FlagsResponse>
    url?: string
}

export async function start(
    {
        waitForFlags = true,
        initInsights = true,
        resetOnInit = false,
        runBeforeInsightsInit = undefined,
        runAfterInsightsInit = undefined,
        type = 'navigate',
        options = {},
        flagsResponseOverrides = {
            sessionRecording: undefined,
            isAuthenticated: false,
            capturePerformance: true,
        },
        url = '/playground/cypress-full/index.html',
    }: StartOptions,
    page: Page,
    context: BrowserContext
) {
    options.opt_out_useragent_filter = true

    // Prepare the mocked Flags API response
    const flagsResponse: FlagsResponse = {
        editorParams: {},
        flags: {
            'session-recording-player': {
                key: '7569-insight-cohorts',
                enabled: true,
                variant: undefined,
                reason: {
                    code: 'condition_match',
                    condition_index: 0,
                    description: 'Matched condition set 1',
                },
                metadata: {
                    id: 1421,
                    version: 1,
                    description: undefined,
                    payload: undefined,
                },
            },
        },
        featureFlags: { 'session-recording-player': true },
        featureFlagPayloads: {},
        errorsWhileComputingFlags: false,
        toolbarParams: {},
        toolbarVersion: 'toolbar',
        isAuthenticated: false,
        siteApps: [],
        supportedCompression: [Compression.GZipJS],
        autocaptureExceptions: false,
        ...flagsResponseOverrides,
    }

    // Mock the remote config endpoint to return the same config data as the flags response.
    // RemoteConfig is now the sole config loading mechanism, so tests must serve it.
    // Uses a regex that excludes config.js (script) — only intercepts the JSON config endpoint.
    void context.route(/\/array\/[^/]+\/config(\?|$)/, (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(flagsResponse),
        })
    })

    // allow promise in e2e tests
    // eslint-disable-next-line compat/compat
    const flagsMock = new Promise((resolve) => {
        void context.route('**/flags/*', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(flagsResponse),
            })
            resolve('mock network to flags was triggered')
        })
    })

    if (type === 'reload') {
        await page.reload()
    } else {
        await gotoPage(page, url)
    }

    runBeforeInsightsInit?.(page)

    // Initialize Insights if required
    if (initInsights) {
        await page.evaluate(
            // TS very unhappy with passing InsightsConfig here, so just pass an object
            (insightsOptions: Record<string, any>) => {
                const opts: Partial<InsightsConfig> = {
                    api_host: 'https://localhost:1234',
                    debug: true,
                    ip: false, // Prevent IP deprecation warning in Playwright tests
                    before_send: (event) => {
                        const win = window as WindowWithInsights
                        win.capturedEvents = win.capturedEvents || []

                        if (event) {
                            win.capturedEvents.push(event)
                        }

                        return event
                    },
                    loaded: (ph) => {
                        if (ph.sessionRecording) {
                            ph.sessionRecording._forceAllowLocalhostNetworkCapture = true
                        }
                        // playwright can't serialize functions to pass around from the playwright to browser context
                        // if we want to run custom code in the loaded function we need to pass it on the page's window,
                        // but it's a new window so we have to create it in the `before_insights_init` option
                        ;(window as any).__ph_loaded?.(ph)
                    },
                    opt_out_useragent_filter: true,
                    ...insightsOptions,
                }

                const windowInsights = (window as WindowWithInsights).insights
                windowInsights?.init('test token', opts)
            },
            options as Record<string, any>
        )
    }

    runAfterInsightsInit?.(page)

    // Reset Insights if required
    if (resetOnInit) {
        await page.evaluate(() => {
            const windowInsights = (window as WindowWithInsights).insights
            windowInsights?.reset(true)
        })
    }

    // Wait for `/flags` response if required
    if (waitForFlags) {
        await flagsMock
    }
}

/**
 * Wait for session recording to actually start after remote config is received
 * This is needed because session recording now waits for fresh remote config before starting
 */
export async function waitForSessionRecordingToStart(page: Page, timeout = 5000): Promise<void> {
    await page.waitForFunction(
        () => {
            const ph = (window as any).insights
            return ph?.sessionRecording?.started === true
        },
        { timeout }
    )
}

/**
 * Wait for remote config to be received and processed
 * Use this when recording might not start due to triggers/sampling, but you need config to be loaded
 * After config is received, status changes from 'pending_config' through 'lazy_loading' to 'active', 'buffering', or 'disabled'
 */
export async function waitForRemoteConfig(page: Page, timeout = 5000): Promise<void> {
    await page.waitForFunction(
        () => {
            const ph = (window as any).insights
            const status = ph?.sessionRecording?.status
            return status !== 'pending_config' && status !== 'lazy_loading' && status !== undefined
        },
        { timeout }
    )
}
