// Server component exports (only available in react-server context)
export { InsightsProvider } from './app/InsightsProvider.js'
export type { InsightsProviderProps, BootstrapFlagsConfig } from './app/InsightsProvider.js'

// Client-safe exports (re-exported so server components can also import them)
export { InsightsPageView } from './client/InsightsPageView.js'
export { useInsights, useFeatureFlag, useActiveFeatureFlags, InsightsFeature } from './client/hooks.js'
