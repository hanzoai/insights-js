export { getFeatureFlagValue } from './featureFlagUtils'
export {
  gzipCompress,
  isGzipData,
  isGzipRequest,
  isGzipSupported,
  isNativeAsyncGzipError,
  isNativeAsyncGzipReadError,
} from './gzip'
export * from './utils'
export * as ErrorTracking from './error-tracking'
export {
  buildOtlpLogRecord,
  buildOtlpLogsPayload,
  getOtlpSeverityNumber,
  getOtlpSeverityText,
  toOtlpAnyValue,
  toOtlpKeyValueList,
} from './logs/logs-utils'
export { PostHogLogs } from './logs'
export type {
  BeforeSendLogFn,
  BufferedLogEntry,
  CaptureLogger,
  LogSdkContext,
  PostHogLogsConfig,
  ResolvedPostHogLogsConfig,
} from './logs/types'
// Re-export the user-facing OTLP log types straight from `@hanzo/insights-types`
// via the `logs/types` barrel so consumers don't have to import from two
// packages to type their `captureLog` calls.
export type { CaptureLogOptions, LogAttributeValue, LogAttributes, LogSeverityLevel } from './logs/types'
export { uuidv7 } from './vendor/uuidv7'
export * from './insights-core'
export * from './insights-core-stateless'
export * from './types'
export { getValidationError, getLengthFromRules, getRequirementsHint } from './surveys/validation'
