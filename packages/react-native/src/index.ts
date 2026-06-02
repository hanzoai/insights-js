import { Insights } from './insights-rn'

export default Insights
export * from './insights-rn'
export * from './hooks/useNavigationTracker'
export * from './hooks/useFeatureFlags'
export * from './hooks/useFeatureFlag'
export * from './hooks/useFeatureFlagResult'
export * from './hooks/useInsights'
export * from './InsightsMaskView'
export * from './InsightsProvider'
export * from './InsightsErrorBoundary'
export * from './types'
export * from './surveys'

// Re-export logs public types so consumers can type their own wrappers
// (e.g. hooks, HOCs, custom loggers) without pulling in @posthog/core.
export type {
  BeforeSendLogFn,
  CaptureLogOptions,
  CaptureLogger,
  LogAttributes,
  LogAttributeValue,
  LogSeverityLevel,
  PostHogLogsConfig,
} from '@posthog/core'
