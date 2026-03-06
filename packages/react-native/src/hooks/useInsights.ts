import type { Insights } from '../insights-rn'
import React from 'react'
import { InsightsContext } from '../InsightsContext'
import { warnIfNoClient } from './utils'

export const useInsights = (): Insights => {
  const { client } = React.useContext(InsightsContext)
  warnIfNoClient(client, 'useInsights')
  return client
}
