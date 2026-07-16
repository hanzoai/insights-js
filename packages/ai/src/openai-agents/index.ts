import { InsightsTracingProcessor } from './processor'
import type { InsightsTracingProcessorOptions } from './processor'

export { InsightsTracingProcessor } from './processor'
export type { InsightsTracingProcessorOptions, DistinctIdResolver } from './processor'

export type InstrumentOptions = InsightsTracingProcessorOptions

/**
 * One-liner to instrument OpenAI Agents SDK with Insights tracing.
 *
 * This registers a InsightsTracingProcessor with the OpenAI Agents SDK,
 * automatically capturing traces, spans, and LLM generations.
 *
 * @param options - Configuration options
 * @returns The registered processor instance
 *
 * @example
 * ```typescript
 * import { instrument } from '@hanzo/insights-ai/openai-agents'
 * import Insights from '@hanzo/insights-node'
 *
 * const phClient = new Insights('<API_KEY>')
 *
 * // Simple setup — await before running agents
 * await instrument({ client: phClient, distinctId: 'user@example.com' })
 *
 * // With dynamic distinct ID
 * await instrument({
 *   client: phClient,
 *   distinctId: (trace) => trace.metadata?.userId,
 *   privacyMode: true,
 *   properties: { environment: 'production' },
 * })
 *
 * // Now run agents as normal - traces automatically sent to Insights
 * import { Agent, run } from '@openai/agents'
 * const agent = new Agent({ name: 'Assistant', instructions: 'You are helpful.' })
 * const result = await run(agent, 'Hello!')
 * ```
 */
export async function instrument(options: InstrumentOptions): Promise<InsightsTracingProcessor> {
  const { addTraceProcessor } = await import('@openai/agents-core')

  const processor = new InsightsTracingProcessor({
    client: options.client,
    distinctId: options.distinctId,
    privacyMode: options.privacyMode,
    groups: options.groups,
    properties: options.properties,
  })

  addTraceProcessor(processor)
  return processor
}
