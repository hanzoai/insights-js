/**
 * Pre-grouped extension bundles for tree-shaking support.
 *
 * Use these with `__extensionClasses` to control which extensions are included in your bundle.
 * The default `@hanzo/insights` entrypoint includes all extensions. When using `@hanzo/insights/slim`,
 * you can import only the bundles you need:
 *
 * @example
 * ```ts
 * import insights from '@hanzo/insights/slim'
 * import { ReplayExtensions, AnalyticsExtensions } from '@hanzo/insights/extensions'
 *
 * insights.init('ph_key', {
 *   __extensionClasses: {
 *     ...ReplayExtensions,
 *     ...AnalyticsExtensions,
 *   }
 * })
 * ```
 *
 * @module
 */

import { Autocapture } from '../autocapture'
import { DeadClicksAutocapture } from './dead-clicks-autocapture'
import { ExceptionObserver } from './exception-autocapture'
import { HistoryAutocapture } from './history-autocapture'
import { TracingHeaders } from './tracing-headers'
import { WebVitalsAutocapture } from './web-vitals'
import { SessionRecording } from './replay/session-recording'
import { Heatmaps } from '../heatmaps'
import { InsightsProductTours } from '../insights-product-tours'
import { SiteApps } from '../site-apps'
import { InsightsConfig } from '../types'

type ExtensionClasses = NonNullable<InsightsConfig['__extensionClasses']>

/** Session replay and related extensions. */
export const SessionReplayExtensions = {
    sessionRecording: SessionRecording,
} as const satisfies ExtensionClasses

/** Autocapture, click tracking, heatmaps, and web vitals. */
export const AnalyticsExtensions = {
    autocapture: Autocapture,
    historyAutocapture: HistoryAutocapture,
    heatmaps: Heatmaps,
    deadClicksAutocapture: DeadClicksAutocapture,
    webVitalsAutocapture: WebVitalsAutocapture,
} as const satisfies ExtensionClasses

/** Automatic exception and error capture. */
export const ErrorTrackingExtensions = {
    exceptionObserver: ExceptionObserver,
} as const satisfies ExtensionClasses

/** In-app product tours. */
export const ProductToursExtensions = {
    productTours: InsightsProductTours,
} as const satisfies ExtensionClasses

/** Site apps support. */
export const SiteAppsExtensions = {
    siteApps: SiteApps,
} as const satisfies ExtensionClasses

/** Distributed tracing header injection. */
export const TracingExtensions = {
    tracingHeaders: TracingHeaders,
} as const satisfies ExtensionClasses

/** All extensions — equivalent to the default `@hanzo/insights` bundle. */
export const AllExtensions = {
    ...SessionReplayExtensions,
    ...AnalyticsExtensions,
    ...ErrorTrackingExtensions,
    ...ProductToursExtensions,
    ...SiteAppsExtensions,
    ...TracingExtensions,
} as const satisfies ExtensionClasses
