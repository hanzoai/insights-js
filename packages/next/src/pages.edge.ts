// Edge-runtime barrel for the `./pages` subpath. Resolved by Next.js's
// `edge-light`, `edge`, and `worker` exports conditions. Excludes
// `getInsights` and `getServerSideInsights` which require Node.js APIs
// (via `insights-node`) that aren't available in the Edge runtime.
export { InsightsProvider } from './pages/InsightsProvider.js'
export { postHogMiddleware } from './middleware/postHogMiddleware.js'
export { InsightsPageView } from './pages/InsightsPageView.js'
export { DEFAULT_INGEST_PATH } from './shared/constants.js'
export type { PagesInsightsProviderProps } from './pages/InsightsProvider.js'
export type { InsightsMiddlewareOptions, InsightsProxyOptions } from './middleware/postHogMiddleware.js'
