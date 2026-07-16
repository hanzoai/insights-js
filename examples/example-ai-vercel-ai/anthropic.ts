/** Vercel AI with Anthropic backend, tracked by Insights via OpenTelemetry. */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { InsightsSpanProcessor } from '@hanzo/insights-ai/otel'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        'service.name': 'example-vercel-ai-app',
        foo: 'bar',
        conversation_id: 'abc-123',
    }),
    spanProcessors: [
        new InsightsSpanProcessor({
            apiKey: process.env.INSIGHTS_API_KEY!,
            host: process.env.INSIGHTS_HOST || 'https://us.i.insights.com',
        }),
    ],
})
sdk.start()

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function main() {
    const { text } = await generateText({
        model: anthropic('claude-sonnet-4-5-20250929'),
        experimental_telemetry: {
            isEnabled: true,
            functionId: 'anthropic-generate',
            metadata: {
                insights_distinct_id: 'example-user',
            },
        },
        prompt: 'Explain observability in three sentences.',
    })

    console.log(text)
}

main().finally(() => sdk.shutdown())
