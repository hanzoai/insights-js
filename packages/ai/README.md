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
  model: 'gpt-3.5-turbo',
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

## OTEL + AI SDK (`experimental_telemetry`)

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

sdk.start()

await generateText({
  model: openai('gpt-5.1'),
  prompt: 'Write a short haiku about debugging',
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'my-awesome-function',
    metadata: {
      conversation_id: 'abc123',
      plan: 'pro',
    },
  },
})

await phClient.shutdown()
```

### Custom Mappers

The OTEL processor supports adapter mappers for different span formats:

- `aiSdkSpanMapper` is the default mapper.
- You can pass custom `mappers` in `InsightsSpanProcessor` options to support additional span schemas.

### Per-call Metadata (Recommended)

For dynamic properties, pass values in `experimental_telemetry.metadata` on each AI SDK call.
These are captured from `ai.telemetry.metadata.*` and forwarded as Insights event properties.
Use processor options (`insightsProperties`) only for global defaults.

## Notes

- The OTEL route currently maps supported spans into Insights AI events (manual capture path).
- Existing wrapper-based tracing (for example `withTracing`) still works and is unchanged.

LLM Observability [docs](https://insights.hanzo.ai/docs/ai-engineering/observability)

Please see the main [Insights docs](https://www.insights.hanzo.ai/docs).

## Questions?

### [Check out our community page.](https://insights.hanzo.ai/posts)
