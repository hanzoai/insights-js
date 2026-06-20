/**
 * @jest-environment jsdom
 *
 * Smoke tests for the per-runtime barrels resolved by the `browser`
 * exports condition. Asserts that client-only barrels expose the
 * documented client-safe surface and DO NOT re-export anything that
 * pulls in `server-only` or `insights-node`. If a server-only symbol
 * leaks in here, Next.js's enforcement plugin will reject the client
 * bundle in consumer apps.
 */

jest.mock('next/router.js', () => ({ useRouter: jest.fn() }))
jest.mock('next/navigation.js', () => ({
    usePathname: jest.fn(),
    useSearchParams: jest.fn(),
}))
jest.mock('@hanzo/insights-react', () => ({
    InsightsContext: { Provider: ({ children }: { children: unknown }) => children },
    useInsights: jest.fn(),
    useFeatureFlagResult: jest.fn(),
    useActiveFeatureFlags: jest.fn(),
    InsightsFeature: jest.fn(() => null),
}))
jest.mock('@hanzo/insights', () => ({ __esModule: true, default: { __loaded: false, init: jest.fn() } }))

import * as pagesClient from '../src/pages.client'
import * as indexClient from '../src/index.client'

const asRecord = (mod: unknown) => mod as Record<string, unknown>

describe('client barrels (browser exports condition)', () => {
    describe("@hanzo/insights-next/pages → 'browser' → pages.client", () => {
        it.each([
            ['InsightsProvider', 'function'],
            ['InsightsPageView', 'function'],
            ['DEFAULT_INGEST_PATH', 'string'],
        ])('exposes %s as %s', (name, expectedType) => {
            expect(typeof asRecord(pagesClient)[name]).toBe(expectedType)
        })

        it.each(['getServerSideInsights', 'getInsights', 'postHogMiddleware'])(
            'omits %s',
            (name) => {
                expect(asRecord(pagesClient)[name]).toBeUndefined()
            }
        )
    })

    describe("@hanzo/insights-next → 'browser' → index.client", () => {
        it.each([
            ['InsightsPageView', 'function'],
            ['useInsights', 'function'],
            ['useFeatureFlag', 'function'],
            ['useActiveFeatureFlags', 'function'],
            ['InsightsFeature', 'function'],
            ['DEFAULT_INGEST_PATH', 'string'],
        ])('exposes %s as %s', (name, expectedType) => {
            expect(typeof asRecord(indexClient)[name]).toBe(expectedType)
        })

        it.each(['InsightsProvider', 'getInsights', 'postHogMiddleware'])('omits %s', (name) => {
            expect(asRecord(indexClient)[name]).toBeUndefined()
        })
    })
})
