/* eslint-disable no-console */
import insightsJs, { PostHogConfig as InsightsConfig } from '@hanzo/insights'

import React, { useEffect, useMemo, useRef } from 'react'
import { Insights, InsightsContext } from './InsightsContext'
import { isDeepEqual } from '../utils/object-utils'

interface PreviousInitialization {
    apiKey: string
    options: Partial<InsightsConfig>
}

type WithOptionalChildren<T> = T & { children?: React.ReactNode | undefined }

/**
 * Props for the InsightsProvider component.
 * This is a discriminated union type that ensures mutually exclusive props:
 *
 * - If `client` is provided, `apiKey` and `options` must not be provided
 * - If `apiKey` is provided, `client` must not be provided, and `options` is optional
 */
type InsightsProviderProps =
    | { client: Insights; apiKey?: never; options?: never }
    | { apiKey: string; options?: Partial<InsightsConfig>; client?: never }

/**
 * InsightsProvider is a React context provider for Hanzo Insights analytics.
 * It can be initialized in two mutually exclusive ways:
 *
 * 1. By providing an existing Insights `client` instance
 * 2. By providing an `apiKey` (and optionally `options`) to create a new client
 *
 * These initialization methods are mutually exclusive - you must use one or the other,
 * but not both simultaneously.
 */
export function InsightsProvider({ children, client, apiKey, options }: WithOptionalChildren<InsightsProviderProps>) {
    const previousInitializationRef = useRef<PreviousInitialization | null>(null)

    const insights = useMemo(() => {
        if (client) {
            if (apiKey) {
                console.warn(
                    '[Insights] You have provided both `client` and `apiKey` to `InsightsProvider`. `apiKey` will be ignored in favour of `client`.'
                )
            }
            if (options) {
                console.warn(
                    '[Insights] You have provided both `client` and `options` to `InsightsProvider`. `options` will be ignored in favour of `client`.'
                )
            }
            return client
        }

        if (apiKey) {
            return insightsJs
        }

        console.warn(
            '[Insights] No `apiKey` or `client` were provided to `InsightsProvider`. Using default global instance. You must initialize it manually. This is not recommended behavior.'
        )
        return insightsJs
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, apiKey, JSON.stringify(options)])

    useEffect(() => {
        if (client) {
            return
        }
        const previousInitialization = previousInitializationRef.current

        if (!previousInitialization) {
            if (insightsJs.__loaded) {
                console.warn('[Insights] `insights` was already loaded elsewhere. This may cause issues.')
            }

            insightsJs.init(apiKey, options)

            previousInitializationRef.current = {
                apiKey: apiKey,
                options: options ?? {},
            }
        } else {
            if (apiKey !== previousInitialization.apiKey) {
                console.warn(
                    "[Insights] You have provided a different `apiKey` to `InsightsProvider` than the one that was already initialized. This is not supported by our provider and we'll keep using the previous key. If you need to toggle between API Keys you need to control the `client` yourself and pass it in as a prop rather than an `apiKey` prop."
                )
            }

            if (options && !isDeepEqual(options, previousInitialization.options)) {
                insightsJs.set_config(options)
            }

            previousInitializationRef.current = {
                apiKey: apiKey,
                options: options ?? {},
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, apiKey, JSON.stringify(options)])

    return (
        <InsightsContext.Provider
            value={{ client: insights, bootstrap: options?.bootstrap ?? client?.config?.bootstrap }}
        >
            {children}
        </InsightsContext.Provider>
    )
}
