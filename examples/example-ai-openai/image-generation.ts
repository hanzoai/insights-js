/** OpenAI image generation, tracked by Insights via OpenTelemetry. */

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

    const response = await client.images.generate({
        model: 'gpt-image-1',
        prompt: 'A hedgehog wearing a Insights t-shirt, pixel art style',
        size: '1024x1024',
    })

    const imageBase64 = response.data[0].b64_json!
    console.log(`Generated image: ${imageBase64.length} chars of base64 data`)
}

main().finally(() => sdk.shutdown())
