import { Insights } from '../../../insights-core'
import { Property } from '../../../types'

const SESSION_RECORDING_FLUSHED_SIZE = '$sess_rec_flush_size'

export class FlushedSizeTracker {
    private readonly _getProperty: (property_name: string) => Property | undefined
    private readonly _setProperty: (prop: string, to: any) => void

    constructor(insights: Insights) {
        if (!insights.persistence) {
            throw new Error('it is not valid to not have persistence and be this far into setting up the application')
        }

        this._getProperty = insights.get_property.bind(insights)
        this._setProperty = insights.persistence.set_property.bind(insights.persistence)
    }

    trackSize(size: number) {
        const currentFlushed = Number(this._getProperty(SESSION_RECORDING_FLUSHED_SIZE)) || 0
        const newValue = currentFlushed + size
        this._setProperty(SESSION_RECORDING_FLUSHED_SIZE, newValue)
    }

    reset() {
        return this._setProperty(SESSION_RECORDING_FLUSHED_SIZE, 0)
    }

    get currentTrackedSize(): number {
        return Number(this._getProperty(SESSION_RECORDING_FLUSHED_SIZE)) || 0
    }
}
