/** Vercel AI streamText, tracked by Insights via OpenTelemetry. */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { InsightsSpanProcessor } from '@hanzo/insights-ai/otel'
import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

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

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })

async function main() {
    const result = streamText({
        model: openai('gpt-4o-mini'),
        experimental_telemetry: {
            isEnabled: true,
            functionId: 'stream-text',
            metadata: {
                insights_distinct_id: 'example-user',
            },
        },
        prompt: 'Explain observability in three sentences.',
    })

    for await (const chunk of result.textStream) {
        process.stdout.write(chunk)
    }

    console.log()
}

main().finally(() => sdk.shutdown())
