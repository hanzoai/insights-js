// Edge-runtime exports (middleware). Excludes InsightsProvider and
// insights-node which require Node.js APIs.
export { insightsMiddleware } from './middleware/insightsMiddleware.js'
export { InsightsPageView } from './client/InsightsPageView.js'
export { DEFAULT_INGEST_PATH } from './shared/constants.js'
export { useInsights, useFeatureFlag, useActiveFeatureFlags, InsightsFeature } from './client/hooks.js'

// Re-export types (type-only, erased at build time)
export type { InsightsProviderProps, BootstrapFlagsConfig } from './app/InsightsProvider.js'
export type { InsightsMiddlewareOptions, InsightsProxyOptions } from './middleware/insightsMiddleware.js'
