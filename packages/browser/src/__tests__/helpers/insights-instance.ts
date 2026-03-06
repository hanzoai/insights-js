// The library depends on having the module initialized before it can be used.
import '../../entrypoints/default-extensions'

import { Insights, init_as_module } from '../../insights-core'
import { InsightsConfig } from '../../types'
import { InsightsPersistence } from '../../insights-persistence'
import { assignableWindow } from '../../utils/globals'
import { uuidv7 } from '../../uuidv7'

export const createInsightsInstance = async (
    // Use a random UUID for the token, such that we don't have to worry
    // about collisions between test cases.
    token: string = uuidv7(),
    config: Partial<InsightsConfig> = {}
): Promise<Insights> => {
    // We need to create a new instance of the library for each test, to ensure
    // that they are isolated from each other. The way the library is currently
    // written, we first create an instance, then call init on it which then
    // creates another instance.
    const insights = new Insights()

    // NOTE: Temporary change whilst testing remote config
    assignableWindow._INSIGHTS_REMOTE_CONFIG = {
        [token]: {
            config: {},
            siteApps: [],
        },
    } as any

    // eslint-disable-next-line compat/compat
    return await new Promise<Insights>((resolve) =>
        insights.init(
            token,
            {
                request_batching: false,
                api_host: 'http://localhost',
                disable_surveys: true,
                disable_surveys_automatic_display: false,
                disable_conversations: true,
                before_send: () => {
                    // if we don't return null here, requests will be sent
                    // but can't go anywhere, and we get console output in tests,
                    // but it's just noise
                    return null
                },
                ...config,
                loaded: (p) => {
                    config.loaded?.(p)

                    resolve(p as Insights)
                },
            },
            'test-' + token
        )
    )
}

const insights = init_as_module()
export const defaultInsights = (): Insights => insights

export const createMockInsights = (overrides: Partial<Insights> = {}): Insights =>
    ({
        config: {
            token: 'test-token',
            api_host: 'https://test.com',
        } as InsightsConfig,
        get_distinct_id: () => 'test-distinct-id',
        capture: jest.fn(),
        _send_request: jest.fn(),
        ...overrides,
    }) as Insights

export const createMockConfig = (overrides: Partial<InsightsConfig> = {}): InsightsConfig =>
    ({
        token: 'test-token',
        api_host: 'https://test.com',
        ...overrides,
    }) as InsightsConfig

export const createMockPersistence = (overrides: Partial<InsightsPersistence> = {}): InsightsPersistence =>
    ({
        register: jest.fn(),
        props: {},
        ...overrides,
    }) as InsightsPersistence
