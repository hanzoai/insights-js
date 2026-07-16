/** OpenAI Responses API with streaming, tracked by Insights via OpenTelemetry. */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { InsightsSpanProcessor } from '@hanzo/insights-ai/otel'
import { OpenAIInstrumentation } from '@opentelemetry/instrumentation-openai'
import OpenAI from 'openai'

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        'service.name': 'example-openai-app',
        'insights.distinct_id': 'example-user',
        foo: 'bar',
        conversation_id: 'abc-123',
    }),
    spanProcessors: [
        new InsightsSpanProcessor({
            apiKey: process.env.INSIGHTS_API_KEY!,
            host: process.env.INSIGHTS_HOST || 'https://us.i.insights.com',
        }),
    ],
    instrumentations: [new OpenAIInstrumentation()],
})
sdk.start()

async function main() {
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
    })

    const stream = await client.responses.create({
        model: 'gpt-4o-mini',
        max_output_tokens: 1024,
        stream: true,
        instructions: 'You are a helpful assistant.',
        input: [
            {
                role: 'user',
                content: 'Write a haiku about product analytics.',
            },
        ],
    })

    for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
            process.stdout.write(event.delta)
        }
    }

    console.log()
}

main().finally(() => sdk.shutdown())
