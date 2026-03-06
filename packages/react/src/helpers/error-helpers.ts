import type { ErrorInfo } from 'react'
import { Insights } from '../context'
import { CaptureResult } from '@hanzo/insights'

export const setupReactErrorHandler = (
    client: Insights,
    callback?: (event: CaptureResult | undefined, error: any, errorInfo: ErrorInfo) => void
) => {
    return (error: any, errorInfo: ErrorInfo): void => {
        const event = client.captureException(error)
        if (callback) {
            callback(event, error, errorInfo)
        }
    }
}
