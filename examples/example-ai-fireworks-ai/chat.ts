/** Fireworks AI chat completions via OpenAI-compatible API, tracked by Insights via OpenTelemetry. */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { InsightsSpanProcessor } from '@hanzo/insights-ai/otel'
import { OpenAIInstrumentation } from '@opentelemetry/instrumentation-openai'
import OpenAI from 'openai'

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        'service.name': 'example-fireworks-ai-app',
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
        baseURL: 'https://api.fireworks.ai/inference/v1',
        apiKey: process.env.FIREWORKS_API_KEY!,
    })

    const response = await client.chat.completions.create({
        model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        max_completion_tokens: 1024,
        messages: [{ role: 'user', content: 'Tell me a fun fact about hedgehogs.' }],
    })

    console.log(response.choices[0].message.content)
}

main().finally(() => sdk.shutdown())
