import type { CostOverride } from '../utils'
import type { AIEvent } from '../utils'
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base'

export type UsageData = Record<string, unknown>

export interface InsightsSpanMapperContext {
  options: InsightsTelemetryOptions
}

export interface InsightsSpanMapperResult {
  distinctId?: string
  traceId?: string
  model?: string
  provider: string
  input: any
  output: any
  latency: number
  timeToFirstToken?: number
  baseURL?: string
  httpStatus?: number
  eventType?: AIEvent
  usage?: UsageData
  tools?: any[] | null
  modelParams?: Record<string, unknown>
  insightsProperties?: Record<string, unknown>
  error?: unknown
}

export interface InsightsSpanMapper {
  name: string
  canMap: (span: ReadableSpan) => boolean
  map: (span: ReadableSpan, context: InsightsSpanMapperContext) => InsightsSpanMapperResult | null
}

export type ShouldExportSpan = (params: { otelSpan: ReadableSpan }) => boolean

export interface InsightsTelemetryOptions {
  insightsDistinctId?: string
  insightsTraceId?: string
  insightsProperties?: Record<string, any>
  insightsPrivacyMode?: boolean
  insightsGroups?: Record<string, any>
  insightsModelOverride?: string
  insightsProviderOverride?: string
  insightsCostOverride?: CostOverride
  insightsCaptureImmediate?: boolean
  mappers?: InsightsSpanMapper[]
  shouldExportSpan?: ShouldExportSpan
}

export type InsightsReadableSpan = ReadableSpan
export type InsightsTelemetrySpanProcessor = SpanProcessor
