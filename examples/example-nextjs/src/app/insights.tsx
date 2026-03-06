'use client'

import { InsightsConfig } from '@hanzo/insights'
import { InsightsProvider } from '@hanzo/insights/react'

const insightsConfig: Partial<InsightsConfig> = {
    api_host: process.env.NEXT_PUBLIC_INSIGHTS_API_HOST,
    debug: process.env.NODE_ENV === 'development',
    capture_exceptions: {
        capture_console_errors: true,
        capture_unhandled_rejections: true,
        capture_unhandled_errors: true,
    },
}

export default function PHProvider({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <InsightsProvider apiKey={process.env.NEXT_PUBLIC_INSIGHTS_PROJECT_API_KEY!} options={insightsConfig}>
            {children}
        </InsightsProvider>
    )
}
