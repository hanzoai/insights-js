'use client'

import React from 'react'
import insightsJs from '@hanzo/insights'
import { InsightsContext } from '@hanzo/insights-react'
import type { BootstrapConfig, InsightsConfig } from '@hanzo/insights'

export type { BootstrapConfig }

export interface ClientInsightsProviderProps {
    /** Insights project API key (starts with phc_) */
    apiKey: string
    /** Optional insights-js configuration overrides */
    options?: Partial<InsightsConfig>
    /** Server-evaluated feature flag values to bootstrap the client SDK with */
    bootstrap?: BootstrapConfig
    children: React.ReactNode
}

/**
 * Client-side Insights provider with SSR bootstrap support.
 *
 * This is an internal component rendered by InsightsProvider (server component).
 * It forwards bootstrap data to insights-js so flag hooks return real values
 * immediately without a network round-trip.
 *
 * We initialize insights-js eagerly during render (client-side only) rather than
 * deferring to a useEffect. React fires effects bottom-up, so child useEffects
 * (e.g. a consent banner) would access the insights instance before the parent
 * provider's useEffect calls init(). By initializing during render and passing
 * the `client` prop, we guarantee the instance is fully configured before any
 * child code runs.
 */
export function ClientInsightsProvider({ apiKey, options, bootstrap, children }: ClientInsightsProviderProps) {
    if (!apiKey) {
        // eslint-disable-next-line no-console
        console.warn('[Insights Next.js] apiKey is required — Insights will not be initialized')
        return <>{children}</>
    }

    const mergedOptions = bootstrap ? { ...options, bootstrap: { ...options?.bootstrap, ...bootstrap } } : options

    // Initialize eagerly during render on the client so that child effects
    // see a fully configured insights instance. The `__loaded` guard prevents
    // double-init (e.g. React StrictMode).
    if (typeof window !== 'undefined' && !insightsJs.__loaded) {
        insightsJs.init(apiKey, mergedOptions)
    }

    return <InsightsContext.Provider value={{ client: insightsJs, bootstrap }}>{children}</InsightsContext.Provider>
}
