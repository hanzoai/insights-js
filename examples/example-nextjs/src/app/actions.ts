'use server'

import { Insights } from 'insights-node'

const insights = new Insights(process.env.NEXT_PUBLIC_INSIGHTS_PROJECT_API_KEY!, {
    host: process.env.NEXT_PUBLIC_INSIGHTS_API_HOST,
})

export async function captureServerError() {
    await insights.captureExceptionImmediate(new Error('Server Exception'), 'distinct_id')
}
