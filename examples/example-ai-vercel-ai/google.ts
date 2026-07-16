/** Vercel AI with Google backend, tracked by Insights via OpenTelemetry. */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { InsightsSpanProcessor } from '@hanzo/insights-ai/otel'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

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

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! })

async function main() {
    const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        experimental_telemetry: {
            isEnabled: true,
            functionId: 'google-generate',
            metadata: {
                insights_distinct_id: 'example-user',
            },
        },
        prompt: 'Explain observability in three sentences.',
    })

    console.log(text)
}

main().finally(() => sdk.shutdown())
