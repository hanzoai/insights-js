import { Insights } from './insights-core'
import { RemoteConfig } from './types'
import { isNullish } from '@hanzo/insights-core'
import { assignableWindow } from './utils/globals'
import { createLogger } from './utils/logger'

export class InsightsLogs {
    private _isLogsEnabled: boolean = false
    private _isLoaded: boolean = false

    constructor(private readonly _instance: Insights) {
        if (this._instance && this._instance.config.logs?.captureConsoleLogs) {
            this._isLogsEnabled = true
        }
    }

    onRemoteConfig(response: RemoteConfig) {
        // only load logs if they are enabled
        const logCapture = response.logs?.captureConsoleLogs
        if (isNullish(logCapture) || !logCapture) {
            return
        }
        this._isLogsEnabled = true
        this.loadIfEnabled()
    }

    reset(): void {}

    loadIfEnabled() {
        if (!this._isLogsEnabled || this._isLoaded) {
            return
        }

        const logger = createLogger('[logs]')
        const phExtensions = assignableWindow?.__InsightsExtensions__
        if (!phExtensions) {
            logger.error('Insights Extensions not found.')
            return
        }

        const loadExternalDependency = phExtensions.loadExternalDependency
        if (!loadExternalDependency) {
            logger.error('Insights loadExternalDependency extension not found.')
            return
        }

        loadExternalDependency(this._instance, 'logs', (err) => {
            if (err || !phExtensions.logs?.initializeLogs) {
                logger.error('Could not load logs script', err)
            } else {
                phExtensions.logs.initializeLogs(this._instance)
                this._isLoaded = true
            }
        })
    }
}
