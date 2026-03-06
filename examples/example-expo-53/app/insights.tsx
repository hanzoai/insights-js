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
    // persistence: 'memory',
    // if using WebView, you have to disable masking for text inputs and images
    // sessionReplayConfig: {
    //   maskAllTextInputs: false,
    //   maskAllImages: false,
    // },
})

insights.debug(true)
