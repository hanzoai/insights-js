# Hanzo Insights AI

TypeScript SDK for LLM observability with Hanzo Insights.

[SEE FULL DOCS](https://insights.hanzo.ai/docs/ai-engineering/observability)

## Installation

```bash
npm install @hanzo/insights-ai
```

## Direct Provider Usage

```typescript
import { OpenAI } from '@hanzo/insights-ai'
import { Insights } from '@hanzo/insights-node'

const phClient = new Insights('<YOUR_PROJECT_API_KEY>', { host: 'https://us.i.insights.hanzo.ai' })

const client = new OpenAI({
  apiKey: '<YOUR_OPENAI_API_KEY>',
  insights: phClient,
})

const completion = await client.chat.completions.create({
  model: 'gpt-5-mini',
  messages: [{ role: 'user', content: 'Tell me a fun fact about hedgehogs' }],
  insightsDistinctId: 'user_123', // optional
  insightsTraceId: 'trace_123', // optional
  insightsProperties: { conversation_id: 'abc123', paid: true }, //optional
  insightsGroups: { company: 'company_id_in_your_db' }, // optional
  insightsPrivacyMode: false, // optional
})

console.log(completion.choices[0].message.content)

// YOU HAVE TO HAVE THIS OR THE CLIENT MAY NOT SEND EVENTS
await phClient.shutdown()
```

## Custom and unsupported providers

Use this when working with Vercel AI SDK telemetry. `@hanzo/ai` exposes an OTEL `SpanProcessor` that maps spans to Insights AI events and sends them through `@hanzo/insights-node`.

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { Insights } from '@hanzo/insights-node'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { InsightsSpanProcessor } from '@hanzo/insights-ai/otel'

const phClient = new Insights('<YOUR_PROJECT_API_KEY>', { host: 'https://us.i.insights.hanzo.ai' })

const sdk = new NodeSDK({
  spanProcessors: [
    new InsightsSpanProcessor(phClient),
  ],
})

await captureAiGeneration(phClient, {
  distinctId: 'user_123',
  traceId: 'trace_abc',
  provider: 'cloudflare-workers-ai',
  model: '@cf/zai-org/glm-4.7-flash',
  input: messages,
  output: result.response,
  modelParameters: { reasoning_effort: 'high' },
  usage: { inputTokens: result.usage?.prompt_tokens, outputTokens: result.usage?.completion_tokens },
  latency: (Date.now() - start) / 1000,
  properties: { feature: 'transcript-toc' },
})

await phClient.shutdown()
```

`captureAiGeneration` is the same primitive that every other `@posthog/ai` wrapper funnels through, so the resulting events are indistinguishable from those produced by `withTracing`, `OpenAI`, `Anthropic`, etc.

## OpenTelemetry

- `aiSdkSpanMapper` is the default mapper.
- You can pass custom `mappers` in `InsightsSpanProcessor` options to support additional span schemas.

```bash
npm install @posthog/ai @opentelemetry/sdk-node @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-http
```

For dynamic properties, pass values in `experimental_telemetry.metadata` on each AI SDK call.
These are captured from `ai.telemetry.metadata.*` and forwarded as Insights event properties.
Use processor options (`insightsProperties`) only for global defaults.

A self-contained `SpanProcessor` that handles batching and export internally. Use this when your setup accepts a span processor.

- The OTEL route currently maps supported spans into Insights AI events (manual capture path).
- Existing wrapper-based tracing (for example `withTracing`) still works and is unchanged.

LLM Observability [docs](https://insights.hanzo.ai/docs/ai-engineering/observability)

Please see the main [Insights docs](https://www.insights.hanzo.ai/docs).

## Questions?

### [Check out our community page.](https://insights.hanzo.ai/posts)
