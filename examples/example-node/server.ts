/* eslint-disable no-console */

import express from 'express'
import { Insights, setupExpressErrorHandler } from 'insights-node'
// import undici from 'undici'

const app = express()

const { INSIGHTS_PROJECT_API_KEY, INSIGHTS_API_HOST, INSIGHTS_PERSONAL_API_KEY } = process.env

const insights = new Insights(INSIGHTS_PROJECT_API_KEY!, {
    host: INSIGHTS_API_HOST,
    flushAt: 1,
    personalApiKey: INSIGHTS_PERSONAL_API_KEY,
    // By default Insights uses node fetch but you can specify your own implementation if preferred
    // fetch(url, options) {
    //   console.log(url, options)
    //   return undici.fetch(url, options)
    // },
})

console.log('LOCAL EVALUATION READY RIGHT AFTER CREATION: ', insights.isLocalEvaluationReady())

insights.on('localEvaluationFlagsLoaded', (count) => {
    console.log('LOCAL EVALUATION READY (localEvaluationFlagsLoaded) EVENT EMITTED: flags count: ', count)
})

insights.debug()

app.get('/', (req, res) => {
    insights.capture({ distinctId: 'EXAMPLE_APP_GLOBAL', event: 'legacy capture' })
    res.send({ hello: 'world' })
})

app.get('/unhandled-error', () => {
    throw new Error('unhandled error')
})

app.get('/error', (req, res) => {
    const error = new Error('example error')
    insights.captureException(error, 'EXAMPLE_APP_GLOBAL')
    res.send({ status: 'error!!' })
})

app.get('/wait-for-local-evaluation-ready', async (req, res) => {
    const FIVE_SECONDS = 5000
    const ready = await insights.waitForLocalEvaluationReady(FIVE_SECONDS)
    res.send({ ready })
})

app.get('/user/:userId/action', (req, res) => {
    insights.capture({ distinctId: req.params.userId, event: 'user did action', properties: req.params })

    res.send({ status: 'ok' })
})

app.get('/user/:userId/flags/:flagId', async (req, res) => {
    const flag = await insights.getFeatureFlag(req.params.flagId, req.params.userId).catch((e) => console.error(e))
    const payload = await insights
        .getFeatureFlagPayload(req.params.flagId, req.params.userId)
        .catch((e) => console.error(e))
    res.send({ [req.params.flagId]: { flag, payload } })
})

app.get('/user/:userId/flags', async (req, res) => {
    const allFlags = await insights.getAllFlagsAndPayloads(req.params.userId).catch((e) => console.error(e))
    res.send(allFlags)
})

// Error handling middleware must be placed at the END of your application stack
setupExpressErrorHandler(insights, app)

const server = app.listen(8020, () => {
    console.log('⚡: Server is running at http://localhost:8020')
})

async function handleExit(signal: any) {
    console.log(`Received ${signal}. Flushing...`)
    await insights.shutdown()
    console.log(`Flush complete`)
    server.close(() => {
        process.exit(0)
    })
}
process.on('SIGINT', handleExit)
process.on('SIGQUIT', handleExit)
process.on('SIGTERM', handleExit)
