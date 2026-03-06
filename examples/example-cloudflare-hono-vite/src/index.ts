import { Hono } from 'hono'
import { Insights } from 'insights-node'

const app = new Hono()

const insights = new Insights(
  process.env.INSIGHTS_PROJECT_API_KEY!,
  { host: process.env.INSIGHTS_API_HOST! }
)

app.get('/', async (c) => {

  const error = new Error('test from cloudflare')
  await insights.captureExceptionImmediate(error, 'cloudflare-user-id')

  return c.json({ success: true, message: 'Exception captured!' })
})

export default app
