// Browser-safe exports. InsightsProvider (a server component) is excluded
// because it imports insights-node which uses Node.js APIs.
export { InsightsPageView } from './client/InsightsPageView.js'
export { DEFAULT_INGEST_PATH } from './shared/constants.js'
export { useInsights, useFeatureFlag, useActiveFeatureFlags, InsightsFeature } from './client/hooks.js'

// Re-export types (type-only, erased at build time)
export type { InsightsProviderProps, BootstrapFlagsConfig } from './app/InsightsProvider.js'
export type { InsightsMiddlewareOptions, InsightsProxyOptions } from './middleware/insightsMiddleware.js'
