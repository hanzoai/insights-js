import { SessionIdManager } from '../sessionid'
import { patch } from '../extensions/replay/rrweb-plugins/patch'
import { assignableWindow, window } from '../utils/globals'
import { COOKIELESS_SENTINEL_VALUE } from '../constants'
import { isArray } from '@hanzo/insights-core'

const addTracingHeaders = (
    hostnames: string[],
    distinctId: string,
    sessionManager: SessionIdManager | undefined,
    url: string,
    headers: Headers
): boolean => {
    let reqHostname: string
    try {
        // we don't need to support IE11 here
        // eslint-disable-next-line compat/compat
        reqHostname = new URL(url).hostname
    } catch {
        // If the URL is invalid, we skip adding tracing headers
        return false
    }
    if (isArray(hostnames) && !hostnames.includes(reqHostname)) {
        // Skip if the hostname is not in the list (also skip if hostnames is not an array,
        // because in the earliest version of this __add_tracing_headers was a bool)
        return false
    }

    let hasAddedHeaders = false
    if (sessionManager) {
        const { sessionId, windowId } = sessionManager.checkAndGetSessionAndWindowId(true)
        req.headers.set('X-INSIGHTS-SESSION-ID', sessionId)
        req.headers.set('X-INSIGHTS-WINDOW-ID', windowId)
    }
    if (distinctId !== COOKIELESS_SENTINEL_VALUE) {
        req.headers.set('X-INSIGHTS-DISTINCT-ID', distinctId)
    }
    return hasAddedHeaders
}

type FetchArgs = [URL | RequestInfo] | [URL | RequestInfo, RequestInit | undefined]

const patchFetch = (hostnames: string[], distinctId: string, sessionManager?: SessionIdManager): (() => void) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return patch(window, 'fetch', (originalFetch: typeof fetch) => {
        return function (this: unknown, url: URL | RequestInfo, init?: RequestInit | undefined) {
            const originalArgs = (arguments.length > 1 ? [url, init] : [url]) as FetchArgs
            let fetchArgs = originalArgs

            try {
                const requestUrl = getRequestUrl(url)
                if (requestUrl) {
                    if (isRequest(url)) {
                        // For fetch(Request, init), construct a new Request so init overrides are applied and the
                        // caller's Request is not mutated. For fetch(url, init), avoid this because it exposes string
                        // bodies as ReadableStreams to downstream wrappers in Safari.
                        // eslint-disable-next-line compat/compat
                        const req = new Request(url, init)
                        addTracingHeaders(hostnames, distinctId, sessionManager, req.url, req.headers)
                        fetchArgs = [req]
                    } else {
                        const headers = new Headers(isObjectLike(init) ? init.headers : undefined)
                        if (addTracingHeaders(hostnames, distinctId, sessionManager, requestUrl, headers)) {
                            const initWithHeaders = createFetchInitWithHeaders(init, headers)
                            if (initWithHeaders) {
                                fetchArgs = [url, initWithHeaders]
                            }
                        }
                    }
                }
            } catch {
                fetchArgs = originalArgs
            }

            return originalFetch.apply(this, fetchArgs)
        }
    })
}

const patchXHR = (hostnames: string[], distinctId: string, sessionManager?: SessionIdManager): (() => void) => {
    return patch(
        // we can assert this is present because we've checked previously
        window!.XMLHttpRequest.prototype,
        'open',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        (originalOpen: typeof XMLHttpRequest.prototype.open) => {
            return function (
                method: string,
                url: string | URL,
                async = true,
                username?: string | null,
                password?: string | null
            ) {
                // because this function is returned in its actual context `this` _is_ an XMLHttpRequest
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const xhr = this as XMLHttpRequest

                const headers = new Headers()
                const requestUrl = getRequestUrl(url)
                if (requestUrl) {
                    addTracingHeaders(hostnames, distinctId, sessionManager, requestUrl, headers)
                }

                const result = originalOpen.call(xhr, method, url, async, username, password)

                TRACING_HEADERS.forEach((header) => {
                    const value = headers.get(header)
                    if (value) {
                        try {
                            xhr.setRequestHeader(header, value)
                        } catch {
                            // Do not let tracing header injection break the host app's XHR.
                        }
                    }
                })

                return result
            }
        }
    )
}

assignableWindow.__InsightsExtensions__ = assignableWindow.__InsightsExtensions__ || {}
const patchFns = {
    _patchFetch: patchFetch,
    _patchXHR: patchXHR,
}
assignableWindow.__InsightsExtensions__.tracingHeadersPatchFns = patchFns

// we used to put tracingHeadersPatchFns on window, and now we put it on __InsightsExtensions__
// but that means that old clients which lazily load this extension are looking in the wrong place
// yuck,
// so we also put it directly on the window
// when 1.161.1 is the oldest version seen in production we can remove this
assignableWindow.insightsTracingHeadersPatchFns = patchFns

export default patchFns
