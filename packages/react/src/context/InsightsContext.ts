import insightsJs, { BootstrapConfig } from '@hanzo/insights'
import { createContext } from 'react'

export type Insights = typeof insightsJs

export const InsightsContext = createContext<{ client: Insights; bootstrap?: BootstrapConfig }>({
    client: insightsJs,
    bootstrap: undefined,
})
