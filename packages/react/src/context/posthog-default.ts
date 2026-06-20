import type { Insights } from '@hanzo/insights'

// Process-level singleton, mirroring the insights-js default export which is
// itself a module-level singleton. Safe because setDefaultInsightsInstance is
// only called once at module evaluation time by src/index.ts.
let defaultInsightsInstance: Insights | undefined

export function setDefaultInsightsInstance(instance: Insights | undefined): void {
    defaultInsightsInstance = instance
}

export function getDefaultInsightsInstance(): Insights | undefined {
    return defaultInsightsInstance
}
