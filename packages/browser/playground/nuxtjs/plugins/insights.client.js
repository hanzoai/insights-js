// Keep in sync with https://github.com/Insights/insights.com/blob/master/contents/docs/integrate/_snippets/install-nuxt.mdx
import { defineNuxtPlugin, useRuntimeConfig } from '#imports'

import insights from '@hanzo/insights'
export default defineNuxtPlugin(() => {
    const runtimeConfig = useRuntimeConfig()
    const insightsClient = insights.init(runtimeConfig.public.insightsPublicKey, {
        api_host: runtimeConfig.public.insightsHost,
        capture_pageview: 'history_change',
        loaded: (insights) => {
            if (import.meta.env.MODE === 'development') insights.debug()
        },
    })

    return {
        provide: {
            insights: () => insightsClient,
        },
    }
})
