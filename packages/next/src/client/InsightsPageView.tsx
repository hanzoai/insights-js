'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation.js'
import { useInsights } from '@hanzo/insights-react'
import { getCurrentUrl } from '../shared/browser.js'

/**
 * Tracks pageviews on route change in Next.js App Router.
 *
 * Place this component inside your `InsightsProvider` (typically in `app/layout.tsx`).
 * It will automatically capture a `$pageview` event whenever the route changes.
 *
 * Includes its own Suspense boundary (required by `useSearchParams()`), so you
 * don't need to wrap it in one yourself.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { InsightsProvider, InsightsPageView } from '@hanzo/insights-next'
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html>
 *       <body>
 *         <InsightsProvider apiKey={process.env.NEXT_PUBLIC_INSIGHTS_KEY!}>
 *           <InsightsPageView />
 *           {children}
 *         </InsightsProvider>
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export function InsightsPageView() {
    return (
        <Suspense fallback={null}>
            <PageViewTracker />
        </Suspense>
    )
}

function PageViewTracker() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const insights = useInsights()

    useEffect(() => {
        const search = searchParams.toString()
        const currentUrl = getCurrentUrl(search ? `${pathname}?${search}` : pathname)
        if (!insights || !currentUrl) {
            return
        }

        insights.capture('$pageview', { $current_url: currentUrl })
    }, [pathname, searchParams, insights])

    return null
}
