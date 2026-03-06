import { useNuxtApp } from '#app'
import type insights from '@hanzo/insights'

/**
 * Get the Insights client instance
 *
 * @remarks
 * This composable provides access to the Insights client instance initialized.
 * It returns `undefined` on the server side or if Insights is not yet initialized.
 *
 * @example
 * ```ts
 * const insights = useInsights()
 * insights.capture('event')
 * ```
 *
 * @returns The Insights client instance
 */
export function useInsights(): typeof insights | undefined {
  const { $insights } = useNuxtApp()
  return ($insights as () => typeof insights | undefined)?.()
}
