/** Google Gemini streaming chat, tracked by Insights via OpenTelemetry. */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { InsightsSpanProcessor } from '@hanzo/insights-ai/otel'
import { GenAIInstrumentation } from '@traceloop/instrumentation-google-generativeai'
import { GoogleGenAI } from '@google/genai'

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        'service.name': 'example-gemini-app',
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
    instrumentations: [new GenAIInstrumentation()],
})
sdk.start()

async function main() {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const stream = await client.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: 'Explain observability in three sentences.',
    })

    for await (const chunk of stream) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
            process.stdout.write(text)
        }
    }

    console.log()
}

main().finally(() => sdk.shutdown())
