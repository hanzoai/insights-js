import type { Insights } from '@hanzo/insights'
import type { BootstrapConfig } from '@hanzo/insights'
import { createContext } from 'react'
import { getDefaultInsightsInstance } from './insights-default'

export type { Insights }

// The getter defers evaluation so that the full bundle's setDefaultInsightsInstance()
// call (which runs after module evaluation) has already executed by the time React
// accesses the default value. In the slim bundle no default is set, so client will
// be undefined — users must always provide a <InsightsProvider client={…}>.
export const InsightsContext = createContext<{ client: Insights; bootstrap?: BootstrapConfig }>({
    get client() {
        return getDefaultInsightsInstance() as Insights
    },
    bootstrap: undefined,
})
