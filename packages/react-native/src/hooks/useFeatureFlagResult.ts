import { useEffect, useState } from 'react'
import { useOverridableInsights } from './utils'
import { FeatureFlagResult } from '@hanzo/insights-core'
import { Insights } from '../insights-rn'

export function useFeatureFlagResult(flag: string, client?: Insights): FeatureFlagResult | undefined {
  const insights = useOverridableInsights(client, 'useFeatureFlagResult')
  const [result, setResult] = useState<FeatureFlagResult | undefined>(insights?.getFeatureFlagResult(flag))

  useEffect(() => {
    setResult(insights?.getFeatureFlagResult(flag))
    return insights?.onFeatureFlags(() => {
      setResult(insights.getFeatureFlagResult(flag))
    })
  }, [insights, flag])

  return result
}
