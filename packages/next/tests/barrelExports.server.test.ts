/**
 * @jest-environment node
 *
 * Smoke tests for the per-runtime barrels resolved when running outside
 * a browser bundle: the `default` (Node server) and `edge`/`edge-light`/
 * `worker` (Edge runtime) exports conditions, plus `react-server`. The
 * default barrels are the superset; the edge barrels deliberately omit
 * Node-server-only symbols so that bundles targeting the Edge runtime
 * don't transitively pull in `insights-node`.
 */

jest.mock('server-only', () => ({}))
jest.mock('next/router.js', () => ({ useRouter: jest.fn() }))
jest.mock('next/navigation.js', () => ({
    usePathname: jest.fn(),
    useSearchParams: jest.fn(),
}))
jest.mock('next/headers.js', () => ({
    cookies: jest.fn(),
    headers: jest.fn(),
}))
jest.mock('next/server.js', () => ({
    NextResponse: { next: jest.fn(), rewrite: jest.fn() },
}))
jest.mock('@hanzo/insights-react', () => ({
    InsightsContext: { Provider: ({ children }: { children: unknown }) => children },
    useInsights: jest.fn(),
    useFeatureFlagResult: jest.fn(),
    useActiveFeatureFlags: jest.fn(),
    InsightsFeature: jest.fn(() => null),
}))
jest.mock('@hanzo/insights', () => ({ __esModule: true, default: { __loaded: false, init: jest.fn() } }))
jest.mock('@hanzo/insights-node', () => ({ Insights: jest.fn() }))

import * as pagesNode from '../src/pages'
import * as pagesEdge from '../src/pages.edge'
import * as indexNode from '../src/index'
import * as indexEdge from '../src/index.edge'
import * as indexReactServer from '../src/index.react-server'

const asRecord = (mod: unknown) => mod as Record<string, unknown>

describe('server barrels (default / edge / react-server exports conditions)', () => {
    describe("@hanzo/insights-next/pages → 'default' / 'react-server' → pages", () => {
        it.each([
            ['InsightsProvider', 'function'],
            ['InsightsPageView', 'function'],
            ['getServerSideInsights', 'function'],
            ['getInsights', 'function'],
            ['insightsMiddleware', 'function'],
            ['DEFAULT_INGEST_PATH', 'string'],
        ])('exposes %s as %s', (name, expectedType) => {
            expect(typeof asRecord(pagesNode)[name]).toBe(expectedType)
        })
    })

    describe("@hanzo/insights-next/pages → 'edge' → pages.edge", () => {
        it.each([
            ['InsightsProvider', 'function'],
            ['insightsMiddleware', 'function'],
            ['InsightsPageView', 'function'],
            ['DEFAULT_INGEST_PATH', 'string'],
        ])('exposes %s as %s', (name, expectedType) => {
            expect(typeof asRecord(pagesEdge)[name]).toBe(expectedType)
        })

        it.each(['getServerSideInsights', 'getInsights'])('omits %s', (name) => {
            expect(asRecord(pagesEdge)[name]).toBeUndefined()
        })
    })

    describe("@hanzo/insights-next → 'default' → index", () => {
        it.each([
            ['InsightsProvider', 'function'],
            ['InsightsPageView', 'function'],
            ['getInsights', 'function'],
            ['insightsMiddleware', 'function'],
            ['DEFAULT_INGEST_PATH', 'string'],
        ])('exposes %s as %s', (name, expectedType) => {
            expect(typeof asRecord(indexNode)[name]).toBe(expectedType)
        })
    })

    describe("@hanzo/insights-next → 'edge' → index.edge", () => {
        it.each([
            ['insightsMiddleware', 'function'],
            ['InsightsPageView', 'function'],
            ['DEFAULT_INGEST_PATH', 'string'],
        ])('exposes %s as %s', (name, expectedType) => {
            expect(typeof asRecord(indexEdge)[name]).toBe(expectedType)
        })

        it.each(['InsightsProvider', 'getInsights'])('omits %s', (name) => {
            expect(asRecord(indexEdge)[name]).toBeUndefined()
        })
    })

    describe("@hanzo/insights-next → 'react-server' → index.react-server", () => {
        it.each([
            ['InsightsProvider', 'function'],
            ['InsightsPageView', 'function'],
            ['useInsights', 'function'],
            ['useFeatureFlag', 'function'],
            ['useActiveFeatureFlags', 'function'],
            ['InsightsFeature', 'function'],
        ])('exposes %s as %s', (name, expectedType) => {
            expect(typeof asRecord(indexReactServer)[name]).toBe(expectedType)
        })
    })
})
