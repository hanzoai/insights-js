import type { PostHogCoreOptions } from '@hanzo/insights-core'

export type PostHogOptions = {
  autocapture?: boolean
  persistence?: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory'
  persistence_name?: string
  captureHistoryEvents?: boolean
} & PostHogCoreOptions
