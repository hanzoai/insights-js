import React from 'react'
import type { InsightsConfig, BootstrapConfig } from '@hanzo/insights'
import { ClientInsightsProvider } from '../client/ClientInsightsProvider.js'
import { NEXTJS_CLIENT_DEFAULTS, resolveApiKey, resolveHostOrDefault } from '../shared/config.js'

export interface PagesInsightsProviderProps {
    /**
     * Insights project API key (starts with phc_).
     * If omitted, reads from `NEXT_PUBLIC_INSIGHTS_KEY` env var.
     */
    apiKey?: string
    /** Optional insights-js configuration overrides. */
    clientOptions?: Partial<InsightsConfig>
    /** Server-evaluated bootstrap data from getServerSideInsights. */
    bootstrap?: BootstrapConfig
    children: React.ReactNode
}

/**
 * Insights provider for Next.js Pages Router.
 *
 * Place this in your `pages/_app.tsx` wrapping `<Component {...pageProps} />`.
 *
 * @example
 * ```tsx
 * import { InsightsProvider } from '@hanzo/insights-next/pages'
 *
 * export default function App({ Component, pageProps }: AppProps) {
 *   return (
 *     <InsightsProvider apiKey={process.env.NEXT_PUBLIC_INSIGHTS_KEY!}>
 *       <Component {...pageProps} />
 *     </InsightsProvider>
 *   )
 * }
 * ```
 */
let apiKeyWarned = false

export function InsightsProvider({ apiKey: apiKeyProp, clientOptions, bootstrap, children }: PagesInsightsProviderProps) {
    const apiKey = resolveApiKey(apiKeyProp)
    if (!apiKey) {
        return <>{children}</>
    }

    if (!apiKeyWarned && !apiKey.startsWith('phc_')) {
        apiKeyWarned = true
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

    return (
        <ClientInsightsProvider apiKey={apiKey} options={resolvedOptions} bootstrap={bootstrap}>
            {children}
        </ClientInsightsProvider>
    )
}
