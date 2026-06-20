import { Insights } from '@hanzo/insights-node'
import type { InsightsOptions } from '@hanzo/insights-node'

const cache = new Map<string, Insights>()

// Auto-detect waitUntil from @vercel/functions at module load.
// Fails gracefully in environments where it's not available.
const autoDetectedWaitUntil: Promise<((p: Promise<unknown>) => void) | undefined> = import(
    /* webpackIgnore: true */ '@vercel/functions'
)
    .then((mod) => mod.waitUntil)
    .catch(() => undefined)

/**
 * Returns a cached Insights node client, creating one if needed.
 *
 * Clients are cached by project key + host. Only the options from the first
 * call for a given key+host pair take effect; subsequent calls with different
 * options (e.g. flushAt, flushInterval) will return the existing client.
 *
 * On first call, awaits auto-detection of @vercel/functions waitUntil
 * and merges it into options. Explicit options.waitUntil takes priority.
 */
export async function getOrCreateNodeClient(apiKey: string, options?: Partial<InsightsOptions>): Promise<Insights> {
    const key = `${apiKey}:${options?.host ?? ''}`
    let client = cache.get(key)
    if (!client) {
        const waitUntil = options?.waitUntil ?? (await autoDetectedWaitUntil)
        const mergedOptions: Partial<InsightsOptions> = {
            ...(waitUntil ? { waitUntil } : {}),
            ...options,
        }
        client = new Insights(apiKey, mergedOptions)
        cache.set(key, client)
    }
    return client
}
