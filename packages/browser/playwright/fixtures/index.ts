import { FlagsResponse, InsightsConfig } from '@/types'
import { testIngestion } from './ingestion'
export const test = testIngestion
export { expect } from '@playwright/test'
export type { WindowWithInsights } from './insights'

export { NetworkPage } from './network'
export { InsightsPage } from './insights'
export { EventsPage } from './events'
export { IngestionPage } from './ingestion'

export type StartOptions = {
    insightsOptions?: Partial<InsightsConfig>
    flagsOverrides?: Partial<FlagsResponse>
    staticOverrides?: Record<string, string>
    url?: string
}
