import { v4 as uuidv4 } from 'uuid'
import { Insights } from '@hanzo/insights-node'
import { sendEventToInsights, sendEventWithErrorToInsights } from '../utils'
import { defaultSpanMappers } from './mappers'
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import type { InsightsTelemetryOptions, InsightsSpanMapper, UsageData } from './types'

function pickMapper(span: ReadableSpan, mappers: InsightsSpanMapper[]): InsightsSpanMapper | undefined {
  return mappers.find((mapper) => {
    try {
      return mapper.canMap(span)
    } catch {
      return false
    }
  })
}

function getTraceId(span: ReadableSpan, options: InsightsTelemetryOptions, mapperTraceId?: string): string {
  if (mapperTraceId) {
    return mapperTraceId
  }
  if (options.insightsTraceId) {
    return options.insightsTraceId
  }
  const spanTraceId = span.spanContext?.().traceId
  return spanTraceId || uuidv4()
}

function buildInsightsParams(
  options: InsightsTelemetryOptions,
  traceId: string,
  distinctId: string | undefined,
  modelParams: Record<string, unknown>,
  insightsProperties: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...modelParams,
    insightsDistinctId: distinctId,
    insightsTraceId: traceId,
    insightsProperties,
    insightsPrivacyMode: options.insightsPrivacyMode,
    insightsGroups: options.insightsGroups,
    insightsModelOverride: options.insightsModelOverride,
    insightsProviderOverride: options.insightsProviderOverride,
    insightsCostOverride: options.insightsCostOverride,
    insightsCaptureImmediate: options.insightsCaptureImmediate,
  }
}

export async function captureSpan(
  span: ReadableSpan,
  phClient: Insights,
  options: InsightsTelemetryOptions = {}
): Promise<void> {
  if (options.shouldExportSpan && options.shouldExportSpan({ otelSpan: span }) === false) {
    return
  }

  const mappers = options.mappers ?? defaultSpanMappers
  const mapper = pickMapper(span, mappers)
  if (!mapper) {
    return
  }

  const mapped = mapper.map(span, { options })
  if (!mapped) {
    return
  }

  const traceId = getTraceId(span, options, mapped.traceId)
  const distinctId = mapped.distinctId ?? options.insightsDistinctId
  const insightsProperties = {
    ...options.insightsProperties,
    ...mapped.insightsProperties,
  }

  const params = buildInsightsParams(options, traceId, distinctId, mapped.modelParams ?? {}, insightsProperties)
  const baseURL = mapped.baseURL ?? ''
  const usage: UsageData = mapped.usage ?? {}

  if (mapped.error !== undefined) {
    await sendEventWithErrorToInsights({
      eventType: mapped.eventType,
      client: phClient,
      distinctId,
      traceId,
      model: mapped.model,
      provider: mapped.provider,
      input: mapped.input,
      output: mapped.output,
      latency: mapped.latency,
      baseURL,
      params: params as any,
      usage,
      tools: mapped.tools,
      error: mapped.error,
      captureImmediate: options.insightsCaptureImmediate,
    })
    return
  }

  await sendEventToInsights({
    eventType: mapped.eventType,
    client: phClient,
    distinctId,
    traceId,
    model: mapped.model,
    provider: mapped.provider,
    input: mapped.input,
    output: mapped.output,
    latency: mapped.latency,
    timeToFirstToken: mapped.timeToFirstToken,
    baseURL,
    params: params as any,
    httpStatus: mapped.httpStatus ?? 200,
    usage,
    tools: mapped.tools,
    captureImmediate: options.insightsCaptureImmediate,
  })
}
