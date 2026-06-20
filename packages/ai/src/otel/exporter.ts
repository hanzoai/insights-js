import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { ExportResultCode } from '@opentelemetry/core'

import { isAISpan } from './spans'

const DEFAULT_OTEL_HOST = 'https://us.i.insights.hanzo.ai'

function normalizeToken(value?: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeHost(value?: unknown): string {
  const normalizedValue = typeof value === 'string' ? value.trim() : ''
  return normalizedValue || DEFAULT_OTEL_HOST
}

/**
 * Options for the InsightsTraceExporter. Provide `projectToken` to enable exporting. Missing or blank
 * tokens disable the exporter. You can also optionally override the `host` URL. `host` defaults to `https://us.i.insights.hanzo.ai`.
 *
 * @example
 * ```ts
 * import { InsightsTraceExporter } from '@hanzo/insights-ai/otel'
 *
 * new InsightsTraceExporter({ projectToken: 'phc_...' })
 * ```
 *
 * @example
 * ```ts
 * import { InsightsTraceExporter } from '@hanzo/insights-ai/otel'
 *
 * new InsightsTraceExporter({ projectToken: 'phc_...', host: 'https://eu.i.insights.hanzo.ai' })
 * ```
 */
export type InsightsTraceExporterOptions =
  | { projectToken?: string; apiKey?: never; host?: string }
  | {
      /** @deprecated Use `projectToken` instead */
      apiKey?: string
      projectToken?: never
      host?: string
    }

/**
 * An OpenTelemetry `TraceExporter` that sends AI traces to Insights's OTLP
 * ingestion endpoint. Insights converts `gen_ai.*` spans into
 * `$ai_generation` events server-side.
 *
 * Only AI-related spans (those whose name or attribute keys start with
 * `gen_ai.`, `llm.`, `ai.`, or `traceloop.`) are exported; all other
 * spans are silently dropped.
 *
 * Use this when the API you're integrating with only accepts a
 * `TraceExporter` (e.g. Vercel's `registerOTel`) or when you need to
 * plug Insights into an existing processor chain. Otherwise prefer
 * {@link InsightsSpanProcessor}, which is self-contained.
 *
 * Provide `projectToken` to enable exporting. Missing or blank tokens disable the exporter.
 * You can also optionally override the `host` URL.
 *
 * @example
 * ```ts
 * import { InsightsTraceExporter } from '@hanzo/insights-ai/otel'
 * import { registerOTel } from '@vercel/otel'
 *
 * registerOTel({
 *   serviceName: 'my-app',
 *   traceExporter: new InsightsTraceExporter({ projectToken: 'phc_...' }),
 * })
 * ```
 */
export class InsightsTraceExporter extends OTLPTraceExporter {
  private readonly disabled: boolean

  constructor(options: InsightsTraceExporterOptions = {}) {
    const token = normalizeToken(options.projectToken) || normalizeToken(options.apiKey)
    const disabled = !token
    const host = token ? new URL(normalizeHost(options.host)).origin : DEFAULT_OTEL_HOST
    super({
      url: `${host}/i/v0/ai/otel`,
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    })

    this.disabled = disabled
    if (this.disabled) {
      console.warn('[InsightsTraceExporter] projectToken is missing or blank; the exporter will be disabled.')
    }
  }

  override export(spans: ReadableSpan[], resultCallback: (result: { code: number; error?: Error }) => void): void {
    if (this.disabled) {
      // Intentionally report success: missing or blank tokens disable exporting as a compatibility no-op.
      // Reporting failure would make OpenTelemetry treat every span as an export error.
      resultCallback({ code: ExportResultCode.SUCCESS })
      return
    }

    const aiSpans = spans.filter(isAISpan)
    if (aiSpans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS })
      return
    }
    super.export(aiSpans, resultCallback)
  }
}
