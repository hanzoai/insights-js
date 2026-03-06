import { ref, onMounted, onUnmounted } from 'vue'
import { useInsights } from './useInsights'
import type { JsonType } from '@hanzo/insights'

/**
 * Get the payload of a feature flag
 *
 * @remarks
 * This composable initializes with the current feature flag payload and automatically
 * updates when Insights feature flags are reloaded.
 *
 * **Server-Side Rendering (SSR) Behavior:**
 * - During SSR, Insights is typically not available or feature flags are not yet loaded
 * - The returned ref will be `undefined` on the server side
 * - The ref will be properly hydrated on the client side once Insights initializes
 * - Consider using a fallback value or `v-if` directive when rendering based on this value
 *
 * @example
 * ```ts
 * const payload = useFeatureFlagPayload('my-flag')
 * ```
 *
 * @param flag - The feature flag key
 * @returns A reactive ref containing the feature flag payload
 */
export function useFeatureFlagPayload(flag: string) {
  const insights = useInsights()
  const featureFlagPayload = ref<JsonType | undefined>(insights?.getFeatureFlagPayload?.(flag))

  let unsubscribe: (() => void) | undefined
  onMounted(() => {
    if (!insights) return

    // Set initial value in case it wasn't available during setup
    featureFlagPayload.value = insights.getFeatureFlagPayload(flag)

    // Update when feature flags are loaded
    unsubscribe = insights.onFeatureFlags?.(() => {
      featureFlagPayload.value = insights.getFeatureFlagPayload(flag)
    })
  })

  onUnmounted(() => {
    unsubscribe?.()
  })

  return featureFlagPayload
}
