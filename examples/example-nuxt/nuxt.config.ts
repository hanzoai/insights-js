// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@insights/nuxt'],
  compatibilityDate: '2025-11-03',
  insightsConfig: {
    host: process.env.INSIGHTS_API_HOST!,
    publicKey: process.env.INSIGHTS_PROJECT_API_KEY!,
    debug: true,
    clientConfig: {
      capture_exceptions: true,
      capture_pageview: 'history_change',
    },
    serverConfig: {
      enableExceptionAutocapture: true,
    },
    sourcemaps: {
      enabled: true,
      releaseVersion: '3',
      logLevel: 'debug',
      projectId: process.env.INSIGHTS_PROJECT_ID!,
      releaseName: 'my-project',
      personalApiKey: process.env.INSIGHTS_PERSONAL_API_KEY!,
    },
  },
})
