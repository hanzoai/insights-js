/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const functions = require('@google-cloud/functions-framework')
const { Insights } = require('insights-node')

const insights = new Insights(process.env.INSIGHTS_PROJECT_API_KEY, {
    // works as well if you uncomment the following lines
    // flushAt: 1,
    // flushInterval: 0
})
insights.debug(true)

async function sendEvent(id) {
    // works as well if you uncomment the following line, and comment the global insights declaration
    // const insights = new Insights('phc_pQ70jJhZKHRvDIL5ruOErnPy6xiAiWCqlL4ayELj4X8')
    // insights.debug(true)

    insights.capture({
        distinctId: 'test',
        event: 'test' + id,
    })

    await insights.flush()
}

functions.http('helloWorld', async (req, res) => {
    console.info('Insights before hello')

    res.send('Hello, World')

    console.info('Insights before send event')

    await sendEvent(req.executionId)

    console.info('Insights end')
})
