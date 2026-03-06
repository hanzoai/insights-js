import { useEffect, useState } from 'react'
import type { Insights } from '../insights-rn'
import { InsightsFlagsResponse } from '@hanzo/insights-core'
import { useOverridableInsights } from './utils'

export function useFeatureFlags(client?: Insights): InsightsFlagsResponse['featureFlags'] | undefined {
  const insights = useOverridableInsights(client, 'useFeatureFlags')
  const [featureFlags, setFeatureFlags] = useState<InsightsFlagsResponse['featureFlags'] | undefined>(
    insights?.getFeatureFlags()
  )

  useEffect(() => {
    setFeatureFlags(insights?.getFeatureFlags())
    return insights?.onFeatureFlags((flags) => {
      setFeatureFlags(flags)
    })
  }, [insights])

  return featureFlags
}
