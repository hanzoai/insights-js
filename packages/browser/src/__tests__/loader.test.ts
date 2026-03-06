/*
 * Test that basic SDK usage (init, capture, etc) does not
 * blow up in non-browser (node.js) envs. These are not
 * tests of server-side capturing functionality (which is
 * currently not supported in the browser lib).
 */

import { Insights } from '../insights-core'
import { defaultInsights } from './helpers/insights-instance'

import sinon from 'sinon'
import { assignableWindow, window } from '../utils/globals'

describe(`Module-based loader in Node env`, () => {
    const insights = defaultInsights()

    beforeEach(() => {
        // NOTE: Temporary change whilst testing remote config
        assignableWindow._INSIGHTS_REMOTE_CONFIG = {
            'test-token': {
                config: {},
                siteApps: [],
            },
        } as any
        // assignableWindow.__InsightsExtensions__ = {}

        jest.useFakeTimers()
        jest.spyOn(insights, '_send_request').mockReturnValue()
        jest.spyOn(window!.console, 'log').mockImplementation()
    })

    it('should load and capture the pageview event', () => {
        const sandbox = sinon.createSandbox()
        let loaded = false
        const _originalCapture = insights.capture
        insights.capture = sandbox.spy()
        insights.init(`test-token`, {
            disable_surveys: true,
            disable_conversations: true,
            debug: true,
            persistence: `localStorage`,
            api_host: `https://test.com`,
            loaded: function () {
                loaded = true
            },
        })

        jest.runOnlyPendingTimers()

        sinon.assert.calledOnce(insights.capture as sinon.SinonSpy<any>)
        const captureArgs = (insights.capture as sinon.SinonSpy<any>).args[0]
        const event = captureArgs[0]
        expect(event).toBe('$pageview')
        expect(loaded).toBe(true)

        insights.capture = _originalCapture
    })

    it(`supports identify()`, () => {
        expect(() => insights.identify(`Pat`)).not.toThrow()
    })

    it(`supports capture()`, () => {
        expect(() => insights.capture(`Pat`)).not.toThrow()
    })

    it(`always returns insights from init`, () => {
        console.error = jest.fn()
        console.warn = jest.fn()

        expect(insights.init(`my-test`, { disable_surveys: true, disable_conversations: true }, 'sdk-1')).toBeInstanceOf(
            Insights
        )
        expect(insights.init(``, { disable_surveys: true, disable_conversations: true }, 'sdk-2')).toBeInstanceOf(
            Insights
        )

        expect(console.error).toHaveBeenCalledWith(
            '[Insights.js]',
            'Insights was initialized without a token. This likely indicates a misconfiguration. Please check the first argument passed to insights.init()'
        )

        // Already loaded logged even when not debug
        expect(insights.init(`my-test`, { disable_surveys: true, disable_conversations: true }, 'sdk-1')).toBeInstanceOf(
            Insights
        )
        expect(console.warn).toHaveBeenCalledWith(
            '[Insights.js]',
            'You have already initialized Insights! Re-initializing is a no-op'
        )
    })
})
