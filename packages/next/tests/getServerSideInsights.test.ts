import { getServerSideInsights } from '../src/pages/getServerSideInsights'

const mockEnterContext = jest.fn()
const mockGetAllFlags = jest.fn()
const mockGetAllFlagsAndPayloads = jest.fn()

jest.mock('@hanzo/insights-node', () => ({
    Insights: jest.fn().mockImplementation(() => ({
        enterContext: mockEnterContext,
        getAllFlags: mockGetAllFlags,
        getAllFlagsAndPayloads: mockGetAllFlagsAndPayloads,
    })),
}))

function createMockContext(cookies: Record<string, string> = {}, extraHeaders: Record<string, string> = {}) {
    return {
        req: {
            headers: {
                cookie: Object.entries(cookies)
                    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
                    .join('; '),
                ...extraHeaders,
            },
        },
        res: {},
        query: {},
        resolvedUrl: '/test',
    } as any
}

describe('getServerSideInsights', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        delete process.env.NEXT_PUBLIC_INSIGHTS_KEY
    })

    it('returns an insights client', async () => {
        const { Insights } = require('@hanzo/insights-node')
        const ctx = createMockContext({
            ph_phc_test123_insights: JSON.stringify({
                distinct_id: 'user_abc',
                $device_id: 'device_xyz',
            }),
        })

        const insights = await getServerSideInsights(ctx, 'phc_test123')
        expect(insights).toBeDefined()
        expect(Insights).toHaveBeenCalledWith('phc_test123', {
            host: 'https://insights.hanzo.ai',
        })
    })

    it('calls enterContext with distinctId and properties', async () => {
        const ctx = createMockContext({
            ph_phc_test123_insights: JSON.stringify({
                distinct_id: 'user_abc',
                $device_id: 'device_xyz',
                $sesid: [1708700000000, 'session-123', 1708700000000],
            }),
        })

        await getServerSideInsights(ctx, 'phc_test123')
        expect(mockEnterContext).toHaveBeenCalledWith({
            distinctId: 'user_abc',
            sessionId: 'session-123',
            properties: { $session_id: 'session-123', $device_id: 'device_xyz' },
        })
    })

    it('reads apiKey from NEXT_PUBLIC_INSIGHTS_KEY env when not provided', async () => {
        process.env.NEXT_PUBLIC_INSIGHTS_KEY = 'phc_env_key'
        const ctx = createMockContext({
            ph_phc_env_key_insights: JSON.stringify({
                distinct_id: 'user_abc',
                $device_id: 'device_xyz',
            }),
        })

        await getServerSideInsights(ctx)
        expect(mockEnterContext).toHaveBeenCalledWith({
            distinctId: 'user_abc',
            properties: { $device_id: 'device_xyz' },
        })
    })

    it('warns and returns a disabled client when no apiKey provided and env not set', async () => {
        const { Insights } = require('@hanzo/insights-node')
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        const ctx = createMockContext({})

        const insights = await getServerSideInsights(ctx)

        expect(insights).toBeDefined()
        expect(Insights).toHaveBeenCalledWith('', {
            host: 'https://insights.hanzo.ai',
        })
        expect(mockEnterContext).not.toHaveBeenCalled()
        expect(warnSpy).toHaveBeenCalledWith('[Insights Next.js] apiKey is required — Insights will not be initialized')
        warnSpy.mockRestore()
    })

    it('trims apiKey and host before creating the node client', async () => {
        const { Insights } = require('@hanzo/insights-node')
        const ctx = createMockContext({})

        await getServerSideInsights(ctx, '  phc_test123\n', { host: '  https://custom.insights.example.com/\t ' })

        expect(Insights).toHaveBeenCalledWith('phc_test123', {
            host: 'https://custom.insights.example.com/',
        })
    })

    it('defaults host when it is omitted', async () => {
        const { Insights } = require('@hanzo/insights-node')
        const ctx = createMockContext({})

        await getServerSideInsights(ctx, 'phc_default_host_test')

        expect(Insights).toHaveBeenCalledWith('phc_default_host_test', {
            host: 'https://insights.hanzo.ai',
        })
    })

    describe('tracing headers', () => {
        it('uses tracing headers when present and no cookie exists', async () => {
            const ctx = createMockContext(
                {},
                {
                    'x-insights-session-id': 'header-session-456',
                    'x-insights-distinct-id': 'header-user-789',
                    'x-insights-window-id': 'window-abc',
                }
            )

            await getServerSideInsights(ctx, 'phc_test123')
            expect(mockEnterContext).toHaveBeenCalledWith({
                distinctId: 'header-user-789',
                sessionId: 'header-session-456',
                properties: {
                    $session_id: 'header-session-456',
                    $window_id: 'window-abc',
                },
            })
        })

        it('tracing headers override cookie values for distinctId and sessionId', async () => {
            const ctx = createMockContext(
                {
                    ph_phc_test123_insights: JSON.stringify({
                        distinct_id: 'cookie-user',
                        $device_id: 'device_xyz',
                        $sesid: [1708700000000, 'cookie-session', 1708700000000],
                    }),
                },
                {
                    'x-insights-session-id': 'header-session',
                    'x-insights-distinct-id': 'header-user',
                }
            )

            await getServerSideInsights(ctx, 'phc_test123')
            expect(mockEnterContext).toHaveBeenCalledWith({
                distinctId: 'header-user',
                sessionId: 'header-session',
                properties: {
                    $session_id: 'header-session',
                    $device_id: 'device_xyz',
                },
            })
        })

        it('falls back to cookie values when tracing headers are absent', async () => {
            const ctx = createMockContext({
                ph_phc_test123_insights: JSON.stringify({
                    distinct_id: 'cookie-user',
                    $device_id: 'device_xyz',
                    $sesid: [1708700000000, 'cookie-session', 1708700000000],
                }),
            })

            await getServerSideInsights(ctx, 'phc_test123')
            expect(mockEnterContext).toHaveBeenCalledWith({
                distinctId: 'cookie-user',
                sessionId: 'cookie-session',
                properties: { $session_id: 'cookie-session', $device_id: 'device_xyz' },
            })
        })

        it('adds $window_id from tracing headers alongside cookie properties', async () => {
            const ctx = createMockContext(
                {
                    ph_phc_test123_insights: JSON.stringify({
                        distinct_id: 'cookie-user',
                        $device_id: 'device_xyz',
                        $sesid: [1708700000000, 'cookie-session', 1708700000000],
                    }),
                },
                {
                    'x-insights-window-id': 'window-123',
                }
            )

            await getServerSideInsights(ctx, 'phc_test123')
            expect(mockEnterContext).toHaveBeenCalledWith({
                distinctId: 'cookie-user',
                sessionId: 'cookie-session',
                properties: {
                    $session_id: 'cookie-session',
                    $device_id: 'device_xyz',
                    $window_id: 'window-123',
                },
            })
        })
    })
})
