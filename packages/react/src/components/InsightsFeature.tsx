import { useFeatureFlagPayload, useFeatureFlagVariantKey, useInsights } from '../hooks'
import React, { JSX } from 'react'
import { Insights } from '../context'
import { isFunction, isUndefined } from '../utils/type-utils'
import { VisibilityAndClickTrackers } from './internal/VisibilityAndClickTrackers'

export type InsightsFeatureProps = Omit<React.HTMLProps<HTMLDivElement>, 'children'> & {
    flag: string
    children: React.ReactNode | ((payload: any) => React.ReactNode)
    fallback?: React.ReactNode
    match?: string | boolean
    visibilityObserverOptions?: IntersectionObserverInit
    trackInteraction?: boolean
    trackView?: boolean
}

export function InsightsFeature({
    flag,
    match,
    children,
    fallback,
    visibilityObserverOptions,
    trackInteraction,
    trackView,
    ...props
}: InsightsFeatureProps): JSX.Element | null {
    const payload = useFeatureFlagPayload(flag)
    const variant = useFeatureFlagVariantKey(flag)
    const insights = useInsights()

    const shouldTrackInteraction = trackInteraction ?? true
    const shouldTrackView = trackView ?? true

    if (!isUndefined(variant)) {
        if (isUndefined(match) || variant === match) {
            const childNode: React.ReactNode = isFunction(children) ? children(payload) : children
            return (
                <VisibilityAndClickTrackers
                    flag={flag}
                    options={visibilityObserverOptions}
                    trackInteraction={shouldTrackInteraction}
                    trackView={shouldTrackView}
                    onInteract={() => captureFeatureInteraction({ flag, insights, flagVariant: variant })}
                    onView={() => captureFeatureView({ flag, insights, flagVariant: variant })}
                    {...props}
                >
                    {childNode}
                </VisibilityAndClickTrackers>
            )
        }
    }
    return <>{fallback}</>
}

export function captureFeatureInteraction({
    flag,
    insights,
    flagVariant,
}: {
    flag: string
    insights: Insights
    flagVariant?: string | boolean
}) {
    const properties: Record<string, any> = {
        feature_flag: flag,
        $set: { [`$feature_interaction/${flag}`]: flagVariant ?? true },
    }
    if (typeof flagVariant === 'string') {
        properties.feature_flag_variant = flagVariant
    }
    insights.capture('$feature_interaction', properties)
}

export function captureFeatureView({
    flag,
    insights,
    flagVariant,
}: {
    flag: string
    insights: Insights
    flagVariant?: string | boolean
}) {
    const properties: Record<string, any> = {
        feature_flag: flag,
        $set: { [`$feature_view/${flag}`]: flagVariant ?? true },
    }
    if (typeof flagVariant === 'string') {
        properties.feature_flag_variant = flagVariant
    }
    insights.capture('$feature_view', properties)
}
