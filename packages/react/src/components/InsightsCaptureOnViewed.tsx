import React, { Children, useCallback, useRef, JSX } from 'react'
import { useInsights } from '../hooks'
import { VisibilityAndClickTracker } from './internal/VisibilityAndClickTracker'

export type InsightsCaptureOnViewedProps = React.HTMLProps<HTMLDivElement> & {
    name?: string
    properties?: Record<string, any>
    observerOptions?: IntersectionObserverInit
    trackAllChildren?: boolean
}

function TrackedChild({
    child,
    index,
    name,
    properties,
    observerOptions,
}: {
    child: React.ReactNode
    index: number
    name?: string
    properties?: Record<string, any>
    observerOptions?: IntersectionObserverInit
}): JSX.Element {
    const trackedRef = useRef(false)
    const insights = useInsights()

    const onIntersect = useCallback(
        (entry: IntersectionObserverEntry) => {
            if (entry.isIntersecting && !trackedRef.current) {
                insights.capture('$element_viewed', {
                    element_name: name,
                    child_index: index,
                    ...properties,
                })
                trackedRef.current = true
            }
        },
        [insights, name, index, properties]
    )

    return (
        <VisibilityAndClickTracker onIntersect={onIntersect} trackView={true} options={observerOptions}>
            {child}
        </VisibilityAndClickTracker>
    )
}

/**
 * InsightsCaptureOnViewed - Track when elements are scrolled into view
 *
 * Wraps any children and automatically sends a `$element_viewed` event
 * when the element comes into the viewport. Only fires once per component instance.
 */
export function InsightsCaptureOnViewed({
    name,
    properties,
    observerOptions,
    trackAllChildren,
    children,
    ...props
}: InsightsCaptureOnViewedProps): JSX.Element {
    const trackedRef = useRef(false)
    const insights = useInsights()

    const onIntersect = useCallback(
        (entry: IntersectionObserverEntry) => {
            if (entry.isIntersecting && !trackedRef.current) {
                insights.capture('$element_viewed', {
                    element_name: name,
                    ...properties,
                })
                trackedRef.current = true
            }
        },
        [insights, name, properties]
    )

    if (trackAllChildren) {
        const trackedChildren = Children.map(children, (child, index) => {
            return (
                <TrackedChild
                    key={index}
                    child={child}
                    index={index}
                    name={name}
                    properties={properties}
                    observerOptions={observerOptions}
                />
            )
        })

        return <div {...props}>{trackedChildren}</div>
    }

    return (
        <VisibilityAndClickTracker onIntersect={onIntersect} trackView={true} options={observerOptions} {...props}>
            {children}
        </VisibilityAndClickTracker>
    )
}
