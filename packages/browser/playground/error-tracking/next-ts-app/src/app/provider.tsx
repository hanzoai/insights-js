'use client'

import insightsJs, { Insights } from '@hanzo/insights'
import { InsightsErrorBoundary } from '@hanzo/insights/react'
import { useEffect, useState } from 'react'

export default function LocalProvider({ debug, children }: { debug: boolean; children: React.ReactNode }) {
    const [client, setClient] = useState<Insights | undefined>()

    useEffect(() => {
        const insights = insightsJs.init(process.env.NEXT_PUBLIC_INSIGHTS_KEY || '', {
            api_host: process.env.NEXT_PUBLIC_INSIGHTS_HOST,
            defaults: '2025-11-30',
        })
        if (debug) {
            insights.debug()
        }
        setClient(insights)
    }, [setClient])

    return (
        <InsightsErrorBoundary
            client={client}
            fallback={<div>An error occurred while rendering the page and exception was captured</div>}
            additionalProperties={{
                hello: 'world',
            }}
        >
            {children}
        </InsightsErrorBoundary>
    )
}
