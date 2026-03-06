import type { InsightsCoreOptions } from '@hanzo/insights-core'

export type InsightsOptions = {
  autocapture?: boolean
  persistence?: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory'
  persistence_name?: string
  captureHistoryEvents?: boolean
} & InsightsCoreOptions
