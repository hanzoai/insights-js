import { generateSurveys } from '../extensions/surveys'

import { assignableWindow } from '../utils/globals'

assignableWindow.__InsightsExtensions__ = assignableWindow.__InsightsExtensions__ || {}
assignableWindow.__InsightsExtensions__.generateSurveys = generateSurveys

// this used to be directly on window, but we moved it to __InsightsExtensions__
// it is still on window for backwards compatibility
assignableWindow.extendInsightsWithSurveys = generateSurveys

export default generateSurveys
