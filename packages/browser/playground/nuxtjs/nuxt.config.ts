// Keep in sync with https://github.com/Insights/insights.com/blob/master/contents/docs/integrate/_snippets/install-nuxt.mdx
export default defineNuxtConfig({
    runtimeConfig: {
        public: {
            insightsPublicKey: process.env.NUXT_PUBLIC_INSIGHTS_KEY || '<ph_project_api_key>',
            insightsHost: process.env.NUXT_PUBLIC_INSIGHTS_HOST || '<ph_client_api_host>',
        },
    },

    compatibilityDate: '2025-03-04',
})
