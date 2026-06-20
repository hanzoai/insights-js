import { useEffect } from 'react'
import { useRouter } from 'next/router.js'
import { useInsights } from '@hanzo/insights-react'
import { getCurrentUrl } from '../shared/browser.js'

/**
 * Tracks pageviews on route change in Next.js Pages Router.
 *
 * Place this component inside your `InsightsProvider` in `pages/_app.tsx`.
 * It will automatically capture a `$pageview` event whenever the route changes.
 *
 * Uses `router.asPath` which includes query parameters and hash fragments.
 *
 * @example
 * ```tsx
 * // pages/_app.tsx
 * import { InsightsProvider, InsightsPageView } from '@hanzo/insights-next/pages'
 *
 * export default function App({ Component, pageProps }: AppProps) {
 *   return (
 *     <InsightsProvider apiKey={process.env.NEXT_PUBLIC_INSIGHTS_KEY!}>
 *       <InsightsPageView />
 *       <Component {...pageProps} />
 *     </InsightsProvider>
 *   )
 * }
 * ```
 */
export function InsightsPageView() {
    const router = useRouter()
    const insights = useInsights()

    useEffect(() => {
        const currentUrl = getCurrentUrl(router.asPath)
        if (!insights || !router.isReady || !currentUrl) {
            return
        }

        insights.capture('$pageview', { $current_url: currentUrl })
    }, [router.asPath, router.isReady, insights])

    return null
}
