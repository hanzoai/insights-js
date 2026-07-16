/** Cloudflare AI Gateway chat completions via OpenAI-compatible API, tracked by Insights via OpenTelemetry. */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { InsightsSpanProcessor } from '@hanzo/insights-ai/otel'
import { OpenAIInstrumentation } from '@opentelemetry/instrumentation-openai'
import OpenAI from 'openai'

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        'service.name': 'example-cloudflare-ai-gateway-app',
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
        defaultHeaders: {
            'cf-aig-authorization': `Bearer ${process.env.CF_AIG_TOKEN}`,
        },
        baseURL: `https://gateway.ai.cloudflare.com/v1/${process.env.CF_AIG_ACCOUNT_ID}/${process.env.CF_AIG_GATEWAY_ID}/compat`,
    })

    const response = await client.chat.completions.create({
        model: 'openai/gpt-5-mini',
        max_completion_tokens: 1024,
        messages: [{ role: 'user', content: 'Tell me a fun fact about hedgehogs.' }],
    })

    console.log(response.choices[0].message.content)
}

main().finally(() => sdk.shutdown())
