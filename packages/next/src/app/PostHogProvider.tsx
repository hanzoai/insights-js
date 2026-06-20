import React from 'react'
import type { InsightsConfig } from '@hanzo/insights'
import { ClientInsightsProvider } from '../client/ClientInsightsProvider.js'
import type { BootstrapConfig } from '../client/ClientInsightsProvider.js'
import { cookies } from 'next/headers.js'
import type { InsightsOptions } from '@hanzo/insights-node'
import { getOrCreateNodeClient } from '../server/nodeClientCache.js'
import { NEXTJS_CLIENT_DEFAULTS, resolveApiKey, resolveHostOrDefault } from '../shared/config.js'
import { readInsightsCookie, isOptedOut } from '../shared/cookie.js'

type AllFlagsOptions = {
    groups?: Record<string, string>
    personProperties?: Record<string, string>
    groupProperties?: Record<string, Record<string, string>>
    onlyEvaluateLocally?: boolean
    disableGeoip?: boolean
    flagKeys?: string[]
}

export interface BootstrapFlagsConfig {
    /** Specific flag keys to evaluate. If omitted, evaluates all flags. */
    flags?: string[]
    /** Groups to evaluate flags for (e.g., `{ company: 'insights' }`). */
    groups?: AllFlagsOptions['groups']
    /** Known person properties to use for flag evaluation. */
    personProperties?: AllFlagsOptions['personProperties']
    /** Known group properties to use for flag evaluation, keyed by group type. */
    groupProperties?: AllFlagsOptions['groupProperties']
}

export interface InsightsProviderProps {
    /**
     * Insights project API key (starts with phc_).
     * If omitted, reads from `NEXT_PUBLIC_INSIGHTS_KEY` env var.
     */
    apiKey?: string
    /** Optional insights-js configuration overrides. */
    clientOptions?: Partial<InsightsConfig>
    /** Options passed to the insights-node client used for server-side flag evaluation. */
    serverOptions?: Partial<InsightsOptions>
    /**
     * Enable server-side feature flag evaluation for bootstrap.
     *
     * When enabled, the provider calls `cookies()` to read the user's
     * identity and evaluates flags via `insights-node`. This opts the
     * route into **dynamic rendering** (incompatible with static
     * generation / ISR).
     *
     * When omitted or falsy (default), no dynamic APIs are called and
     * the provider is safe for static rendering and PPR.
     */
    bootstrapFlags?: boolean | BootstrapFlagsConfig
    children: React.ReactNode
}

/**
 * Insights provider for Next.js App Router.
 *
 * By default this component is **static-safe** — it does not call any
 * dynamic APIs (`cookies()`, `headers()`) and is compatible with static
 * generation, ISR, and Partial Prerendering (PPR).
 *
 * When `bootstrapFlags` is enabled, the provider evaluates feature flags
 * on the server and bootstraps the client SDK, which opts the route into
 * dynamic rendering.
 *
 * All Insights hooks (`useInsights`, `useFeatureFlagEnabled`, etc.)
 * require this provider as an ancestor.
 */
export async function InsightsProvider({
    apiKey: apiKeyProp,
    clientOptions,
    serverOptions,
    bootstrapFlags,
    children,
}: InsightsProviderProps) {
    const apiKey = resolveApiKey(apiKeyProp)
    if (!apiKey) {
        return <>{children}</>
    }

    if (!apiKey.startsWith('phc_')) {
        // eslint-disable-next-line no-console
        console.warn(
            `[Insights Next.js] apiKey "${apiKey}" does not start with "phc_". This may not be a valid Insights project API key.`
        )
    }

    const host = resolveHostOrDefault(clientOptions?.api_host)
    const resolvedOptions: Partial<InsightsConfig> = {
        ...NEXTJS_CLIENT_DEFAULTS,
        ...clientOptions,
        ...(host ? { api_host: host } : {}),
    }

    let bootstrap: BootstrapConfig | undefined

    if (bootstrapFlags) {
        try {
            bootstrap = await evaluateFlags(apiKey, resolvedOptions, bootstrapFlags, serverOptions)

            // Only disable the first-load fetch when we actually have bootstrap data.
            // If evaluateFlags returned undefined (no cookie, opted-out), the client
            // still needs to fetch flags on first load.
            if (bootstrap) {
                resolvedOptions.advanced_disable_feature_flags_on_first_load = true
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[Insights Next.js] Failed to evaluate bootstrap flags:', error)
        }
    }

    return (
        <ClientInsightsProvider apiKey={apiKey} options={resolvedOptions} bootstrap={bootstrap}>
            {children}
        </ClientInsightsProvider>
    )
}

async function evaluateFlags(
    apiKey: string,
    options: Partial<InsightsConfig> | undefined,
    bootstrapFlags: boolean | BootstrapFlagsConfig,
    serverOptions?: Partial<InsightsOptions>
): Promise<BootstrapConfig | undefined> {
    const cookieStore = await cookies()

    if (isOptedOut(cookieStore, apiKey, options)) {
        return undefined
    }

    const cookieState = readInsightsCookie(cookieStore, apiKey)
    if (!cookieState) {
        return undefined
    }

    const host = resolveHostOrDefault(serverOptions?.host)
    const nodeOptions: Partial<InsightsOptions> = { ...serverOptions, ...(host ? { host } : {}) }
    const client = await getOrCreateNodeClient(apiKey, nodeOptions)

    const { flags: flagKeys, ...flagOptions } = typeof bootstrapFlags === 'object' ? bootstrapFlags : {}
    const allFlagsOptions: AllFlagsOptions = { ...flagOptions, ...(flagKeys ? { flagKeys } : {}) }
    return client.getAllFlagsAndPayloads(cookieState.distinctId, allFlagsOptions)
}
