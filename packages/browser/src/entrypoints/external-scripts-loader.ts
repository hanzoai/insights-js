import type { Insights } from '../insights-core'
import { assignableWindow, document, InsightsExtensionKind } from '../utils/globals'
import { createLogger } from '../utils/logger'

const logger = createLogger('[ExternalScriptsLoader]')

const loadScript = (insights: Insights, url: string, callback: (error?: string | Event, event?: Event) => void) => {
    if (insights.config.disable_external_dependency_loading) {
        logger.warn(`${url} was requested but loading of external scripts is disabled.`)
        return callback('Loading of external scripts is disabled')
    }

    // If we add a script more than once then the browser will parse and execute it
    // So, even if idempotent we waste parsing and processing time
    const existingScripts = document?.querySelectorAll('script')
    if (existingScripts) {
        for (let i = 0; i < existingScripts.length; i++) {
            if (existingScripts[i].src === url) {
                const alreadyExistingScriptTag = existingScripts[i]

                if ((alreadyExistingScriptTag as any).__insights_loading_callback_fired) {
                    // script already exists and fired its load event,
                    // we call the callback again, they need to be idempotent
                    return callback()
                }

                // eslint-disable-next-line @hanzo/insights/no-add-event-listener
                alreadyExistingScriptTag.addEventListener('load', (event) => {
                    // it hasn't already loaded
                    // we probably called loadScript twice in quick succession,
                    // so we attach a callback to the onload event
                    ;(alreadyExistingScriptTag as any).__insights_loading_callback_fired = true
                    callback(undefined, event)
                })
                alreadyExistingScriptTag.onerror = (error) => callback(error)

                return // and finish processing here
            }
        }
    }

    const addScript = () => {
        if (!document) {
            return callback('document not found')
        }
        let scriptTag: HTMLScriptElement | null = document.createElement('script')
        scriptTag.type = 'text/javascript'
        scriptTag.crossOrigin = 'anonymous'
        scriptTag.src = url
        scriptTag.onload = (event) => {
            // mark the script as having had its callback fired, so we can avoid double-calling it
            ;(scriptTag as any).__insights_loading_callback_fired = true
            callback(undefined, event)
        }
        scriptTag.onerror = (error) => callback(error)

        if (insights.config.prepare_external_dependency_script) {
            scriptTag = insights.config.prepare_external_dependency_script(scriptTag)
        }

        if (!scriptTag) {
            return callback('prepare_external_dependency_script returned null')
        }

        if (insights.config.external_scripts_inject_target === 'head') {
            document.head.appendChild(scriptTag)
        } else {
            const scripts = document.querySelectorAll('body > script')
            if (scripts.length > 0) {
                scripts[0].parentNode?.insertBefore(scriptTag, scripts[0])
            } else {
                document.body.appendChild(scriptTag)
            }
        }
    }

    if (document?.body) {
        addScript()
    } else {
        // Inlining this because we don't care about `passive: true` here
        // and this saves us ~3% of the bundle size
        // eslint-disable-next-line @hanzo/insights/no-add-event-listener
        document?.addEventListener('DOMContentLoaded', addScript)
    }
}

assignableWindow.__InsightsExtensions__ = assignableWindow.__InsightsExtensions__ || {}
assignableWindow.__InsightsExtensions__.loadExternalDependency = (
    insights: Insights,
    kind: InsightsExtensionKind,
    callback: (error?: string | Event, event?: Event) => void
): void => {
    let scriptUrlToLoad = `/static/${kind}.js` + `?v=${insights.version}`

    if (kind === 'remote-config') {
        scriptUrlToLoad = `/array/${insights.config.token}/config.js`
    }

    if (kind === 'toolbar') {
        // toolbar.js is served from the Insights CDN, this has a TTL of 24 hours.
        // the toolbar asset includes a rotating "token" that is valid for 5 minutes.
        const fiveMinutesInMillis = 5 * 60 * 1000
        // this ensures that we bust the cache periodically
        const timestampToNearestFiveMinutes = Math.floor(Date.now() / fiveMinutesInMillis) * fiveMinutesInMillis

        scriptUrlToLoad = `${scriptUrlToLoad}&t=${timestampToNearestFiveMinutes}`
    }
    const url = insights.requestRouter.endpointFor('assets', scriptUrlToLoad)

    loadScript(insights, url, callback)
}

assignableWindow.__InsightsExtensions__.loadSiteApp = (
    insights: Insights,
    url: string,
    callback: (error?: string | Event, event?: Event) => void
): void => {
    const scriptUrl = insights.requestRouter.endpointFor('api', url)

    loadScript(insights, scriptUrl, callback)
}
