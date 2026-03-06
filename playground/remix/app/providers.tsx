import { useEffect, useState } from 'react'
import insights, { CaptureResult } from '@hanzo/insights'
import { InsightsProvider } from '@insights/react'
import { EventDisplay } from './EventDisplay'

export function PHProvider({ children }: { children: React.ReactNode }) {
    const [hydrated, setHydrated] = useState(false)
    const [events, setEvents] = useState<CaptureResult[]>([])

    useEffect(() => {
        insights.init('phc_test_key_for_playground', {
            api_host: '/ph-relay-xyz123',
            ui_host: 'https://us.insights.com',
            defaults: '2025-11-30',
            before_send: (cr) => {
                setEvents((prev) => [cr!, ...prev].slice(0, 10))
                return cr
            },
        })

        setHydrated(true)
    }, [])

    if (!hydrated) return <>{children}</>
    return (
        <InsightsProvider client={insights}>
            <EventDisplay events={events} />
            {children}
        </InsightsProvider>
    )
}
