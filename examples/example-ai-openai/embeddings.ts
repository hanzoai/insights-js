/** OpenAI embeddings, tracked by Insights via OpenTelemetry. */

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

    const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'Insights is an open-source product analytics platform.',
    })

    const embedding = response.data[0].embedding
    console.log(`Embedding dimensions: ${embedding.length}`)
    console.log(`First 5 values: ${embedding.slice(0, 5)}`)
}

main().finally(() => sdk.shutdown())
