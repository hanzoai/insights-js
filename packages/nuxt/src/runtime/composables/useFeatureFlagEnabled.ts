import { ref, onMounted, onUnmounted } from 'vue'
import { useInsights } from './useInsights'

/**
 * Check if a feature flag is enabled
 *
 * @remarks
 * This composable initializes with the current feature flag value and automatically
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
 * const isEnabled = useFeatureFlagEnabled('my-flag')
 * ```
 *
 * @param flag - The feature flag key
 * @returns A reactive ref containing the feature flag enabled state (boolean | undefined)
 */
export function useFeatureFlagEnabled(flag: string) {
  const insights = useInsights()
  const featureEnabled = ref<boolean | undefined>(insights?.isFeatureEnabled?.(flag))

  let unsubscribe: (() => void) | undefined
  onMounted(() => {
    if (!insights) return

    // Set initial value in case it wasn't available during setup
    featureEnabled.value = insights.isFeatureEnabled(flag)

    // Update when feature flags are loaded
    unsubscribe = insights.onFeatureFlags?.(() => {
      featureEnabled.value = insights.isFeatureEnabled(flag)
    })
  })

  onUnmounted(() => {
    unsubscribe?.()
  })

  return featureEnabled
}
