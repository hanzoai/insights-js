import { defineApp } from 'convex/server'
import insights from '@insights/convex/convex.config.js'

const app = defineApp()
app.use(insights)

export default app
