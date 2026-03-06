import { Insights } from '../insights-core'
import { assignableWindow } from '../utils/globals'
import { createLogger } from '../utils/logger'
import { isUndefined } from '@hanzo/insights-core'

const logger = createLogger('[TracingHeaders]')

export class TracingHeaders {
    private _restoreXHRPatch: (() => void) | undefined = undefined
    private _restoreFetchPatch: (() => void) | undefined = undefined

    constructor(private readonly _instance: Insights) {}

    private _loadScript(cb: () => void): void {
        if (assignableWindow.__InsightsExtensions__?.tracingHeadersPatchFns) {
            // already loaded
            cb()
        }

        assignableWindow.__InsightsExtensions__?.loadExternalDependency?.(this._instance, 'tracing-headers', (err) => {
            if (err) {
                return logger.error('failed to load script', err)
            }
            cb()
        })
    }
    public startIfEnabledOrStop() {
        if (this._instance.config.__add_tracing_headers) {
            this._loadScript(this._startCapturing)
        } else {
            this._restoreXHRPatch?.()
            this._restoreFetchPatch?.()
            // we don't want to call these twice so we reset them
            this._restoreXHRPatch = undefined
            this._restoreFetchPatch = undefined
        }
    }

    private _startCapturing = () => {
        if (isUndefined(this._restoreXHRPatch)) {
            assignableWindow.__InsightsExtensions__?.tracingHeadersPatchFns?._patchXHR(
                this._instance.config.__add_tracing_headers || [],
                this._instance.get_distinct_id(),
                this._instance.sessionManager
            )
        }
        if (isUndefined(this._restoreFetchPatch)) {
            assignableWindow.__InsightsExtensions__?.tracingHeadersPatchFns?._patchFetch(
                this._instance.config.__add_tracing_headers || [],
                this._instance.get_distinct_id(),
                this._instance.sessionManager
            )
        }
    }
}
