import 'server-only'

import { isFunction } from '@hanzo/insights-core'
import type { InsightsOptions, IInsights } from '@hanzo/insights-node'
import { cookies, headers } from 'next/headers.js'
import { getOrCreateNodeClient } from './nodeClientCache.js'
import { readInsightsCookie, isOptedOut } from '../shared/cookie.js'
import { resolveApiKey, resolveHostOrDefault } from '../shared/config.js'
import { readTracingHeaders, buildContextData } from '../shared/tracing-headers.js'

/**
 * Returns a Insights server client scoped to the current request.
 *
 * Reads the user's identity from the Insights cookie and returns a
 * request-scoped client. Methods like `getAllFlags()`, `getFeatureFlagResult()`,
 * and `capture()` automatically use the current user's identity.
 *
 * Calls `cookies()` and `headers()` internally, which opts the route into dynamic rendering.
 *
 * @param apiKey - Insights project API key. If omitted, reads from `NEXT_PUBLIC_INSIGHTS_KEY`.
 * @param options - Optional `insights-node` configuration (e.g., `{ host: '...' }`).
 * @returns A `insights-node` client scoped to the current user.
 *
 * @example
 * ```ts
 * import { getInsights } from '@hanzo/insights-next'
 *
 * export default async function Page() {
 *     const insights = await getInsights()
 *     const flags = await insights.getAllFlags()
 *     insights.capture({ event: 'page_viewed' })
 *     return <div>...</div>
 * }
 * ```
 */
export async function getInsights(apiKey?: string, options?: Partial<InsightsOptions>): Promise<IInsights> {
    const resolvedApiKey = resolveApiKey(apiKey)
    const host = resolveHostOrDefault(options?.host)
    const resolvedOptions = { ...options, host }
    const client = await getOrCreateNodeClient(resolvedApiKey ?? '', resolvedOptions)

    if (!resolvedApiKey) {
        return client
    }

    const cookieStore = await cookies()

    if (isOptedOut(cookieStore, resolvedApiKey)) {
        return client
    }

    const state = readInsightsCookie(cookieStore, resolvedApiKey)
    const headerStore = await headers()
    const tracing = readTracingHeaders(headerStore)
    const contextData = buildContextData(tracing, state)

    // Wrap the shared client in a Proxy that applies request-scoped context
    // to every method call. We can't use enterContext() here because
    // AsyncLocalStorage.enterWith() doesn't propagate back to the caller
    // across the await boundary of this async function.
    return new Proxy(client, {
        get(target, prop, receiver) {
            if (prop === 'withContext') {
                return Reflect.get(target, prop, receiver)
            }
            const value = Reflect.get(target, prop, receiver)
            if (isFunction(value)) {
                return (...args: unknown[]) => target.withContext(contextData, () => value.apply(target, args))
            }
            return value
        },
    }) as IInsights
}
