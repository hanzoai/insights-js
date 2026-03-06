import { Insights } from '../../insights-core'
import { createLogger } from '../../utils/logger'

const logger = createLogger('[Stylesheet Loader]')

export const prepareStylesheet = (document: Document, innerText: string, insights?: Insights) => {
    // Forcing the existence of `document` requires this function to be called in a browser environment
    let stylesheet: HTMLStyleElement | null = document.createElement('style')
    stylesheet.innerText = innerText

    if (insights?.config?.prepare_external_dependency_stylesheet) {
        stylesheet = insights.config.prepare_external_dependency_stylesheet(stylesheet)
    }

    if (!stylesheet) {
        logger.error('prepare_external_dependency_stylesheet returned null')
        return null
    }

    return stylesheet
}
