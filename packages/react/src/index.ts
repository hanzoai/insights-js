import insightsJs from '@hanzo/insights'
import { setDefaultInsightsInstance } from './context/insights-default'

setDefaultInsightsInstance(insightsJs)

export * from './context'
export * from './hooks'
export * from './components'
export * from './helpers'
