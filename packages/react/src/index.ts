import posthogJs from '@hanzo/insights'
import { setDefaultPostHogInstance } from './context/posthog-default'

setDefaultPostHogInstance(posthogJs)

export * from './context'
export * from './hooks'
export * from './components'
export * from './helpers'
