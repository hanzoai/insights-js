/**
 * @insights/types - Type definitions for the Insights JavaScript SDK
 *
 * This package provides TypeScript type definitions for the Insights SDK,
 * allowing you to type the Insights instance and its configuration options.
 */

// Insights instance type
export type { Insights } from './insights'

// Common types
export type { Property, Properties, JsonType, JsonRecord } from './common'

// Capture types
export type {
    KnownEventName,
    KnownUnsafeEditableEvent,
    EventName,
    CaptureResult,
    CaptureOptions,
    BeforeSendFn,
} from './capture'

// Feature flag types
export type {
    FeatureFlagsCallback,
    FeatureFlagDetail,
    FeatureFlagMetadata,
    EvaluationReason,
    FeatureFlagResult,
    FeatureFlagOptions,
    RemoteConfigFeatureFlagCallback,
    EarlyAccessFeature,
    EarlyAccessFeatureStage,
    EarlyAccessFeatureCallback,
    EarlyAccessFeatureResponse,
    FeatureFlagOverrides,
    FeatureFlagPayloadOverrides,
    FeatureFlagOverrideOptions,
    OverrideFeatureFlagsOptions,
} from './feature-flags'

// Request types
export type { Headers, RequestResponse, RequestCallback } from './request'

// Session recording types
export type {
    SessionRecordingCanvasOptions,
    InitiatorType,
    NetworkRequest,
    CapturedNetworkRequest,
    SessionIdChangedCallback,
    SeverityLevel,
} from './session-recording'

// Config types
export type {
    AutocaptureCompatibleElement,
    DomAutocaptureEvents,
    AutocaptureConfig,
    RageclickConfig,
    BootstrapConfig,
    SupportedWebVitalsMetrics,
    PerformanceCaptureConfig,
    DeadClickCandidate,
    ExceptionAutoCaptureConfig,
    DeadClicksAutoCaptureConfig,
    HeatmapConfig,
    ConfigDefaults,
    ExternalIntegrationKind,
    ErrorTrackingOptions,
    MaskInputOptions,
    SlimDOMOptions,
    SessionRecordingOptions,
    RequestQueueConfig,
    InsightsConfig,
} from './insights-config'

// Segment integration types
export type { SegmentUser, SegmentAnalytics, SegmentPlugin, SegmentContext, SegmentFunction } from './segment'

// Survey types
export type { SurveyRenderReason } from './survey'

// Toolbar types
export type { ToolbarParams, ToolbarUserIntent, ToolbarSource, ToolbarVersion } from './toolbar'
