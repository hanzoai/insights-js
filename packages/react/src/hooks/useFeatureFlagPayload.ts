import { JsonType } from '@hanzo/insights'
import { useContext, useEffect, useState } from 'react'
import { InsightsContext } from '../context'

export function useFeatureFlagPayload(flag: string): JsonType {
    const { client, bootstrap } = useContext(InsightsContext)

    const [featureFlagPayload, setFeatureFlagPayload] = useState<JsonType>(() => client.getFeatureFlagPayload(flag))

    useEffect(() => {
        return client.onFeatureFlags(() => {
            setFeatureFlagPayload(client.getFeatureFlagPayload(flag))
        })
    }, [client, flag])

    // if the client is not loaded yet, use the bootstrapped value
    if (!client?.featureFlags?.hasLoadedFlags && bootstrap?.featureFlagPayloads) {
        return bootstrap.featureFlagPayloads[flag]
    }

    return featureFlagPayload
}
