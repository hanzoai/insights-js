import type { InsightsConfig } from '@hanzo/insights'
import type { InsightsOptions } from '@hanzo/insights-node'
import { DEFAULT_API_HOST } from './constants.js'

/**
 * Configuration for the client-side Insights provider.
 * Extends the standard insights-js config.
 */
export type InsightsClientConfig = Partial<InsightsConfig>

/**
 * Configuration for the server-side Insights client.
 * Extends the standard insights-node options.
 */
export type InsightsServerConfig = InsightsOptions

/**
 * Resolves the Insights API key from an explicit value or the
 * `NEXT_PUBLIC_INSIGHTS_KEY` environment variable.
 *
 * Warns and returns undefined if neither is available.
 */
export function normalizeConfigValue(value?: unknown): string | undefined {
    const normalizedValue = typeof value === 'string' ? value.trim() : ''
    return normalizedValue || undefined
}

export function resolveApiKey(apiKey?: unknown): string | undefined {
    const resolved = normalizeConfigValue(apiKey) ?? normalizeConfigValue(process.env.NEXT_PUBLIC_INSIGHTS_KEY)
    if (!resolved) {
        // eslint-disable-next-line no-console
        console.warn('[Insights Next.js] apiKey is required — Insights will not be initialized')
    }
    return resolved
}

export function resolveHost(host?: unknown): string | undefined {
    return normalizeConfigValue(host) ?? normalizeConfigValue(process.env.NEXT_PUBLIC_INSIGHTS_HOST)
}

export function resolveHostOrDefault(host?: unknown): string {
    return resolveHost(host) ?? DEFAULT_API_HOST
}

/**
 * Next.js-specific defaults for the insights-js client.
 *
 * These ensure the server can read both identity and consent state from cookies:
 * - `capture_pageview: false` — disables insights-js automatic pageviews so the
 *   `InsightsPageView` component can handle them without duplicates
 * - `persistence: 'localStorage+cookie'` — already the insights-js default, made explicit
 * - `opt_out_capturing_persistence_type: 'cookie'` — writes consent state to a cookie
 *   so middleware/server components can read it (insights-js default is 'localStorage')
 * - `opt_out_persistence_by_default: true` — when opted out, disables persistence
 *   so insights-js does not write cookies or localStorage; the middleware
 *   handles deleting the identity cookie separately
 *
 * Users can override any of these via the `options` prop on InsightsProvider.
 */
export const NEXTJS_CLIENT_DEFAULTS: Partial<InsightsConfig> = {
    capture_pageview: false,
    persistence: 'localStorage+cookie',
    opt_out_capturing_persistence_type: 'cookie',
    opt_out_persistence_by_default: true,
}
