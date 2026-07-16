/* eslint-disable no-console */

import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Insights } from '@hanzo/insights-node'
import { InsightsInterceptor } from '@hanzo/insights-node/nestjs'
import { AppModule } from './app.module'

const { INSIGHTS_PROJECT_API_KEY, INSIGHTS_HOST } = process.env

export const insights = new Insights(INSIGHTS_PROJECT_API_KEY!, {
    host: INSIGHTS_HOST,
    flushAt: 1,
})

insights.debug()

async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    app.useGlobalInterceptors(new InsightsInterceptor(insights, { captureExceptions: true }))

    await app.listen(8030)
    console.log('⚡: NestJS server is running at http://localhost:8030')
}

bootstrap()

async function handleExit(signal: string) {
    console.log(`Received ${signal}. Flushing...`)
    await insights.shutdown()
    console.log('Flush complete')
    process.exit(0)
}
process.on('SIGINT', handleExit)
process.on('SIGQUIT', handleExit)
process.on('SIGTERM', handleExit)
