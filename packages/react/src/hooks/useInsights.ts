import { useContext } from 'react'
import { Insights, InsightsContext } from '../context'

export const useInsights = (): Insights => {
    const { client } = useContext(InsightsContext)
    return client
}
