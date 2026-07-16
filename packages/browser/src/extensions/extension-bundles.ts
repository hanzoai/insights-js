/**
 * Pre-grouped extension bundles for tree-shaking support.
 *
 * Each bundle is self-contained: a feature plus its runtime dependencies.
 * Use these with `__extensionClasses` to control which extensions are included in your bundle.
 * The default `insights-js` entrypoint includes all extensions. When using `insights-js/slim`,
 * you can import only the bundles you need:
 *
 * @example
 * ```ts
 * import insights from 'insights-js/slim'
 * import { SessionReplayExtensions, AnalyticsExtensions } from 'insights-js/extensions'
 *
 * insights.init('hi_key', {
 *   __extensionClasses: {
 *     ...SessionReplayExtensions,
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
import { InsightsSurveys } from '../insights-surveys'
import { Toolbar } from './toolbar'
import { InsightsFeatureFlags } from '../insights-featureflags'
import { InsightsExceptions } from '../insights-exceptions'
import { WebExperiments } from '../web-experiments'
import { InsightsConversations } from './conversations/insights-conversations'
import { InsightsLogs } from '../insights-logs'

type ExtensionClasses = NonNullable<InsightsConfig['__extensionClasses']>

/** Feature flags. */
export const FeatureFlagsExtensions = {
    featureFlags: InsightsFeatureFlags,
} as const satisfies ExtensionClasses

/** Session replay. */
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

/** Exception and error capture. Requires both the observer (capture hook) and exceptions (forwarding). */
export const ErrorTrackingExtensions = {
    exceptionObserver: ExceptionObserver,
    exceptions: InsightsExceptions,
} as const satisfies ExtensionClasses

/** In-app product tours. Includes feature flags for targeting. */
export const ProductToursExtensions = {
    productTours: InsightsProductTours,
    ...FeatureFlagsExtensions,
} as const satisfies ExtensionClasses

/** Site apps support. */
export const SiteAppsExtensions = {
    siteApps: SiteApps,
} as const satisfies ExtensionClasses

/** Distributed tracing header injection. */
export const TracingExtensions = {
    tracingHeaders: TracingHeaders,
} as const satisfies ExtensionClasses

/** In-app surveys. Includes feature flags for targeting. */
export const SurveysExtensions = {
    surveys: InsightsSurveys,
    ...FeatureFlagsExtensions,
} as const satisfies ExtensionClasses

/** Insights toolbar for visual element inspection and action setup. */
export const ToolbarExtensions = {
    toolbar: Toolbar,
} as const satisfies ExtensionClasses

/** Web experiments. Includes feature flags for variant evaluation. */
export const ExperimentsExtensions = {
    experiments: WebExperiments,
    ...FeatureFlagsExtensions,
} as const satisfies ExtensionClasses

/** In-app conversations. */
export const ConversationsExtensions = {
    conversations: InsightsConversations,
} as const satisfies ExtensionClasses

/** Console log capture. */
export const LogsExtensions = {
    logs: InsightsLogs,
} as const satisfies ExtensionClasses

/** All extensions — equivalent to the default `insights-js` bundle. */
export const AllExtensions = {
    ...FeatureFlagsExtensions,
    ...SessionReplayExtensions,
    ...AnalyticsExtensions,
    ...ErrorTrackingExtensions,
    ...ProductToursExtensions,
    ...SiteAppsExtensions,
    ...SurveysExtensions,
    ...TracingExtensions,
    ...ToolbarExtensions,
    ...ExperimentsExtensions,
    ...ConversationsExtensions,
    ...LogsExtensions,
} as const satisfies ExtensionClasses
