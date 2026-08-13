import { useContext, useEffect, useState } from 'react'
import { InsightsContext } from '../context'

export function useActiveFeatureFlags(): string[] {
    const { client, bootstrap } = useContext(InsightsContext)

    // featureFlags is TreeShakeable, so a consumer that opts into tree shaking
    // gets undefined here. The guard below already allows for that.
    const [featureFlags, setFeatureFlags] = useState<string[]>(() => client.featureFlags?.getFlags() ?? [])

    useEffect(() => {
        return client.onFeatureFlags((flags) => {
            setFeatureFlags(flags)
        })
    }, [client])

    // if the client is not loaded yet and we have a bootstrapped value, use it
    if (!client?.featureFlags?.hasLoadedFlags && bootstrap?.featureFlags) {
        return Object.keys(bootstrap.featureFlags)
    }

    return featureFlags
}
