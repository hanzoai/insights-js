// Client-runtime barrel for the `./pages` subpath. Resolved by Next.js's
// `browser` exports condition. Excludes `getInsights`, `getServerSideInsights`,
// and `postHogMiddleware`, which import `server-only` or `insights-node` and
// must not be reachable from a client bundle.
export { InsightsProvider } from './pages/InsightsProvider.js'
export { InsightsPageView } from './pages/InsightsPageView.js'
export { DEFAULT_INGEST_PATH } from './shared/constants.js'
export type { PagesInsightsProviderProps } from './pages/InsightsProvider.js'
export type { InsightsMiddlewareOptions, InsightsProxyOptions } from './middleware/postHogMiddleware.js'
