import { useEffect, useState } from 'react'
import { useOverridableInsights } from './utils'
import { JsonType, FeatureFlagValue } from '@hanzo/insights-core'
import { Insights } from '../insights-rn'

export function useFeatureFlag(flag: string, client?: Insights): FeatureFlagValue | undefined {
  const insights = useOverridableInsights(client, 'useFeatureFlag')
  const [featureFlag, setFeatureFlag] = useState<FeatureFlagValue | undefined>(insights?.getFeatureFlag(flag))

  useEffect(() => {
    setFeatureFlag(insights?.getFeatureFlag(flag))
    return insights?.onFeatureFlags(() => {
      setFeatureFlag(insights.getFeatureFlag(flag))
    })
  }, [insights, flag])

  return featureFlag
}

export type FeatureFlagWithPayload = [FeatureFlagValue | undefined, JsonType | undefined]

export function useFeatureFlagWithPayload(flag: string, client?: Insights): FeatureFlagWithPayload {
  const insights = useOverridableInsights(client, 'useFeatureFlagWithPayload')
  const [featureFlag, setFeatureFlag] = useState<FeatureFlagWithPayload>([undefined, undefined])

  useEffect(() => {
    setFeatureFlag([insights?.getFeatureFlag(flag), insights?.getFeatureFlagPayload(flag)])
    return insights?.onFeatureFlags(() => {
      setFeatureFlag([insights.getFeatureFlag(flag), insights.getFeatureFlagPayload(flag)])
    })
  }, [insights, flag])

  return featureFlag
}
