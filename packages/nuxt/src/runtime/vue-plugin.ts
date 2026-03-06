import { defineNuxtPlugin, useRuntimeConfig } from '#app'

import insights from '@hanzo/insights'
import type { InsightsClientConfig, InsightsCommon } from '../module'

export default defineNuxtPlugin({
  name: 'insights-client',
  setup(nuxtApp) {
    const runtimeConfig = useRuntimeConfig()
    const insightsCommon = runtimeConfig.public.insights as InsightsCommon
    const insightsClientConfig = runtimeConfig.public.insightsClientConfig as InsightsClientConfig

    // prevent nitro from trying to load this
    if (!window || insights.__loaded) {
      return
    }

    insights.init(insightsCommon.publicKey, {
      api_host: insightsCommon.host,
      ...insightsClientConfig,
    })

    if (insightsCommon.debug) {
      insights.debug(true)
    }

    if (autocaptureEnabled(insightsClientConfig)) {
      nuxtApp.hook('vue:error', (error, info) => {
        insights.captureException(error, { info })
      })
    }

    return {
      provide: {
        insights: () => insights,
      },
    }
  },
})

function autocaptureEnabled(config: InsightsClientConfig): boolean {
  if (!config) return false
  if (typeof config.capture_exceptions === 'boolean') return config.capture_exceptions
  if (typeof config.capture_exceptions === 'object') return config.capture_exceptions.capture_unhandled_errors === true
  return false
}
