import { expect } from '../utils/insights-playwright-test-base'
import { EventsPage, InsightsPage, test } from '../../fixtures'
import { Insights } from '@/insights-core'
import { CaptureResult } from '@/types'

test.describe('ErrorTracking captureException', () => {
    test.use({ url: '/playground/cypress/index.html' })

    test('captureException(Error)', async ({ events, insights }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            ph.captureException(new Error('wat even am I'), { extra_prop: 2 })
        })
        expect(exception.properties.extra_prop).toEqual(2)
        exceptionMatch(exception, 'Error', 'wat even am I', 1)
    })

    test('captureException(Error) with Error cause', async ({ events, insights }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            const errorWithCause = new Error('wat even am I', {
                cause: new Error('root error'),
            })
            ph.captureException(errorWithCause)
        })
        exceptionMatch(exception, 'Error', 'wat even am I', 2)
    })

    test('captureException(Error) with string cause', async ({ events, insights }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            const errorWithCause = new Error('wat even am I', {
                cause: 'string cause error',
            })
            ph.captureException(errorWithCause)
        })
        exceptionMatch(exception, 'Error', 'wat even am I', 2)
        expect(exception.properties.$exception_list[1].stacktrace).toBeUndefined()
    })

    test('captureException(Error) with cyclic causes', async ({ events, insights }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            const errorWithCause = new Error('wat even am I')
            errorWithCause.cause = errorWithCause
            ph.captureException(errorWithCause)
        })
        exceptionMatch(exception, 'Error', 'wat even am I', 5)
    })

    test('captureException(string)', async ({ insights, events }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            ph.captureException('I am a plain old string', { extra_prop: 2 })
        })
        expect(exception.properties.extra_prop).toEqual(2)
        exceptionMatch(exception, 'Error', 'I am a plain old string')
    })

    test('captureException(Object)', async ({ insights, events }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            const exceptionObject = { key: 'foo', value: 'bar' }
            ph.captureException(exceptionObject)
        })
        exceptionMatch(exception, 'Error', 'Object captured as exception with keys: key, value')
    })

    test('captureException(Object) with name and message', async ({ insights, events }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            const exceptionObject = { name: 'foo', message: 'bar' }
            ph.captureException(exceptionObject)
        })
        exceptionMatch(exception, 'Error', "'foo' captured as exception with message: 'bar'")
    })

    test('captureException(DOMException)', async ({ insights, events, browserName }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            const exceptionObject = new DOMException('exception message', 'exception name')
            ph.captureException(exceptionObject)
        })
        if (browserName === 'firefox') {
            exceptionMatch(exception, 'DOMException', 'exception name: exception message')
        } else {
            exceptionMatch(exception, 'DOMException', 'exception name: exception message', 1, false)
        }
    })

    test('captureException(ErrorEvent)', async ({ insights, events }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            class CustomError extends Error {
                constructor(message: string) {
                    super(message)
                    this.name = 'CustomError'
                }
            }
            const exceptionObject = new ErrorEvent('Main message', {
                message: 'Option error message',
                filename: 'filename',
                lineno: 1,
                colno: 1,
                error: new CustomError('Sub error message'),
            })
            ph.captureException(exceptionObject)
        })
        exceptionMatch(exception, 'CustomError', 'Sub error message')
    })

    test('captureException(Event)', async ({ insights, events }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            const customEvent = new Event('This is an event')
            ph.captureException(customEvent)
        })
        exceptionMatch(exception, 'Event', 'Event captured as exception with keys: isTrusted')
    })

    test('captureException(number)', async ({ insights, events }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            ph.captureException(1)
        })
        exceptionMatch(exception, 'Error', 'Primitive value captured as exception: 1')
    })

    test('captureException(null)', async ({ insights, events }) => {
        const exception = await bootstrap(insights, events, (ph) => {
            ph.captureException(null)
        })
        exceptionMatch(exception, 'Error', 'Primitive value captured as exception: null')
    })
})

async function bootstrap(insights: InsightsPage, events: EventsPage, cb: (ph: Insights) => void): Promise<CaptureResult> {
    await insights.init({
        request_batching: false,
    })
    await insights.evaluate(cb)
    const exception = await events.waitForEvent('$exception')
    events.expectCountMap({
        $exception: 1,
    })
    return exception
}

async function exceptionMatch(
    exception: CaptureResult,
    type: string,
    value: string | number | undefined,
    exceptionCount: number = 1,
    hasStacktrace: boolean = true
) {
    expect(exception.event).toEqual('$exception')
    expect(exception.properties.$exception_source).toBeUndefined()
    expect(exception.properties.$exception_list).toHaveLength(exceptionCount)
    expect(exception.properties.$exception_list[0].type).toEqual(type)
    expect(exception.properties.$exception_list[0].value).toEqual(value)
    if (hasStacktrace) {
        expect(exception.properties.$exception_list[0].stacktrace).toBeDefined()
    } else {
        expect(exception.properties.$exception_list[0].stacktrace).toBeUndefined()
    }
}
