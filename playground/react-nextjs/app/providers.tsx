'use client'

import insights, { CaptureResult } from '@hanzo/insights'
import { InsightsProvider } from '@insights/react'
import { useEffect, useState } from 'react'
import { EventDisplay } from './EventDisplay'

let eventListeners: ((event: CaptureResult | null) => void)[] = []

export function addEventListener(callback: (event: CaptureResult | null) => void) {
    eventListeners.push(callback)
    return () => {
        eventListeners = eventListeners.filter((cb) => cb !== callback)
    }
}

if (typeof window !== 'undefined') {
    insights.init('phc_test_key_for_playground', {
        api_host: 'https://us.i.insights.com',
        person_profiles: 'identified_only',
        capture_pageview: 'history_change',
        capture_pageleave: true,
        before_send: (event) => {
            eventListeners.forEach((callback) => callback(event))
            console.log('Yo! An event', event?.event, event)
            return event
        },
    })
}

export function PHProvider({ children }: { children: React.ReactNode }) {
    const [events, setEvents] = useState<CaptureResult[]>([])

    useEffect(() => {
        const removeListener = addEventListener((event) => {
            if (!event) {
                return
            }
            setEvents((prev) => [event, ...prev].slice(0, 10))
        })

        insights.capture('playground_loaded')

        return removeListener
    }, [])

    return (
        <InsightsProvider client={insights}>
            <EventDisplay events={events} />
            {children}
        </InsightsProvider>
    )
}
