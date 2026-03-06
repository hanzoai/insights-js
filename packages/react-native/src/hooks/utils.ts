import { useContext } from 'react'
import type { Insights } from '../insights-rn'
import { InsightsContext } from '../InsightsContext'

const warnedCallers = new Set<string>()

/**
 * Log an error if the Insights client is not available. Warns once per unique caller to avoid console spam.
 * @internal
 */
export function warnIfNoClient(client: Insights | undefined, caller: string): void {
  if (!client && !warnedCallers.has(caller)) {
    warnedCallers.add(caller)
    console.error(
      `${caller} was called without a Insights client. Wrap your app with <InsightsProvider> or pass a client directly. See https://insights.com/docs/libraries/react-native?#with-the-insightsprovider`
    )
  }
}

/** @internal Exported for testing only. */
export function resetWarnedCallers(): void {
  warnedCallers.clear()
}

/**
 * Returns the first available Insights client from arguments or context, correctly typed. Logs an error if no
 * client is found. This is used internally by hooks that accept an optional client parameter.
 * @internal
 */
export const useOverridableInsights = (client: Insights | undefined, caller: string): Insights | undefined => {
  const { client: contextClient } = useContext(InsightsContext)
  const insights = client ?? (contextClient as Insights | undefined)
  warnIfNoClient(insights, caller)
  return insights
}
