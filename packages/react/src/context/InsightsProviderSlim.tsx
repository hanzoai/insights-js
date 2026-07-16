import React, { useMemo } from 'react'
import type { Insights } from '@hanzo/insights'
import { InsightsContext } from './InsightsContext'

/**
 * Slim InsightsProvider for use with @hanzo/insights-react/slim.
 *
 * Only accepts a pre-initialized `client` instance. Does not support
 * `apiKey`/`options` props since the slim bundle has no @hanzo/insights runtime.
 */
export function InsightsProvider({ client, children }: { client: Insights; children?: React.ReactNode }) {
    const value = useMemo(() => ({ client, bootstrap: client.config?.bootstrap }), [client])
    return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>
}
