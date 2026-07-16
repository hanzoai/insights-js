import type { GetServerSidePropsContext } from 'next'
import type { InsightsOptions, IInsights } from '@hanzo/insights-node'
import { getOrCreateNodeClient } from '../server/nodeClientCache.js'
import { cookieStoreFromHeader, readInsightsCookie, isOptedOut } from '../shared/cookie.js'
import { resolveApiKey, resolveHostOrDefault } from '../shared/config.js'
import { readTracingHeaders, buildContextData } from '../shared/tracing-headers.js'

/**
 * Creates an Insights server client scoped to the current request.
 *
 * Reads the user's identity from the Insights cookie in request headers
 * and sets it as context via `enterContext()`. The returned client is
 * ready to use — methods like `getAllFlags()`, `getFeatureFlagResult()`,
 * and `capture()` automatically use the current user's identity.
 *
 * @param ctx - The Next.js GetServerSidePropsContext
 * @param apiKey - Insights project API key. If omitted, reads from NEXT_PUBLIC_INSIGHTS_KEY.
 * @param options - Optional insights-node configuration
 *
 * @example
 * ```tsx
 * import { getServerSideInsights } from '@hanzo/insights-next/pages'
 *
 * export const getServerSideProps: GetServerSideProps = async (ctx) => {
 *   const insights = await getServerSideInsights(ctx)
 *   const flags = await insights.getAllFlagsAndPayloads()
 *   return { props: { insightsBootstrap: flags } }
 * }
 * ```
 */
export async function getServerSideInsights(
    ctx: GetServerSidePropsContext,
    apiKey?: string,
    options?: Partial<InsightsOptions>
): Promise<IInsights> {
    const resolvedApiKey = resolveApiKey(apiKey)
    const host = resolveHostOrDefault(options?.host)
    const resolvedOptions = { ...options, host }
    const client = await getOrCreateNodeClient(resolvedApiKey ?? '', resolvedOptions)

    if (!resolvedApiKey) {
        return client
    }

    const cookieStore = cookieStoreFromHeader(ctx.req.headers.cookie || '')

    if (!isOptedOut(cookieStore, resolvedApiKey)) {
        const state = readInsightsCookie(cookieStore, resolvedApiKey)
        const tracing = readTracingHeaders(ctx.req.headers)
        client.enterContext(buildContextData(tracing, state))
    }

    return client
}
