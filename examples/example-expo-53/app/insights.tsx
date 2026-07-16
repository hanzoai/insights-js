import Insights from 'insights-react-native'

// If you want to use Session relay on React Native web, use the @hanzo/insights SDK instead.
// Example:
//
// import insights from '@hanzo/insights'
//
// insights.init(process.env.EXPO_PUBLIC_INSIGHTS_PROJECT_API_KEY!, {
//     host: process.env.EXPO_PUBLIC_INSIGHTS_API_HOST,
//     debug: true,
// })
//
// export { insights }

export const insights = new Insights(process.env.EXPO_PUBLIC_INSIGHTS_PROJECT_API_KEY!, {
    host: process.env.EXPO_PUBLIC_INSIGHTS_API_HOST,
    flushAt: 1,
    enableSessionReplay: true,
    captureAppLifecycleEvents: true,
    errorTracking: {
        autocapture: {
            uncaughtExceptions: true,
            unhandledRejections: true,
            console: ['error', 'warn'],
        },
    },
    // Inject X-INSIGHTS-DISTINCT-ID and X-INSIGHTS-SESSION-ID on outgoing fetch
    // requests to these hostnames. Used by the Tracing Headers screen to verify
    // the patch works end-to-end; see https://insights.hanzo.ai/docs/llm-analytics/link-session-replay
    addTracingHeaders: ['httpbin.org'],
    logs: {
        serviceName: 'expo-example',
        environment: 'dev',
        serviceVersion: '0.0.1',
        // The /logs dev-tools panel toggles `beforeSendMode.current` at
        // runtime. The closure here reads it on every capture, so the
        // behavior switches without re-constructing the SDK or touching
        // private internals. Customers wiring runtime-tunable filters
        // should follow this pattern.
        beforeSend: (record) => {
            if (beforeSendMode.current === 'drop') return null
            if (beforeSendMode.current === 'throw') throw new Error('beforeSend boom')
            return record
        },
    },
    // persistence: 'memory',
    // if using WebView, you have to disable masking for text inputs and images
    // sessionReplayConfig: {
    //   maskAllTextInputs: false,
    //   maskAllImages: false,
    // },
})

insights.debug(true)
