import { isFunction, isArray } from '@hanzo/insights-core'
import type { InsightsCookieState } from './cookie.js'
import { cookieStateToProperties } from './cookie.js'

/**
 * Header names used by the Insights browser SDK's tracing headers feature.
 *
 * When `__add_tracing_headers` is enabled in the browser SDK, these headers
 * are added to outgoing fetch/XHR requests so that server-side code can
 * correlate events back to the browser session.
 */
export const INSIGHTS_SESSION_ID_HEADER = 'x-insights-session-id'
export const INSIGHTS_DISTINCT_ID_HEADER = 'x-insights-distinct-id'
export const INSIGHTS_WINDOW_ID_HEADER = 'x-insights-window-id'

export interface TracingHeaderValues {
    distinctId?: string
    sessionId?: string
    windowId?: string
}

/**
 * Extracts Insights tracing header values from request headers.
 *
 * Accepts either a Headers-like object with a `.get()` method (e.g. from
 * `next/headers`) or a plain record (e.g. `ctx.req.headers` in Pages Router).
 */
export function readTracingHeaders(
    headers: { get(name: string): string | null } | Record<string, string | string[] | undefined>
): TracingHeaderValues {
    const getValue = (name: string): string | undefined => {
        if (isFunction((headers as { get: unknown }).get)) {
            return (headers as { get(name: string): string | null }).get(name) ?? undefined
        }
        const value = (headers as Record<string, string | string[] | undefined>)[name]
        return typeof value === 'string' ? value : isArray(value) ? value[0] : undefined
    }

    return {
        distinctId: getValue(INSIGHTS_DISTINCT_ID_HEADER) || undefined,
        sessionId: getValue(INSIGHTS_SESSION_ID_HEADER) || undefined,
        windowId: getValue(INSIGHTS_WINDOW_ID_HEADER) || undefined,
    }
}

/**
 * Builds context data by merging cookie state with tracing headers.
 *
 * Tracing headers take precedence over cookie values for `distinctId` and
 * `sessionId` because they represent the browser's current state and are
 * set per-request by the browser SDK.
 */
export function buildContextData(
    tracing: TracingHeaderValues,
    state: InsightsCookieState | null
): { distinctId: string | undefined; sessionId: string | undefined; properties: Record<string, string> | undefined } {
    const mergedProperties: Record<string, string> = {
        ...cookieStateToProperties(state),
        ...(tracing.sessionId ? { $session_id: tracing.sessionId } : {}),
        ...(tracing.windowId ? { $window_id: tracing.windowId } : {}),
    }
    return {
        distinctId: tracing.distinctId || state?.distinctId,
        sessionId: tracing.sessionId || state?.sessionId,
        properties: Object.keys(mergedProperties).length > 0 ? mergedProperties : undefined,
    }
}
