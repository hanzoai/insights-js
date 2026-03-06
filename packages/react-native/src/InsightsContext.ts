import React from 'react'
import { Insights } from './insights-rn'

export const InsightsContext = React.createContext<{ client: Insights }>({ client: undefined as unknown as Insights })
