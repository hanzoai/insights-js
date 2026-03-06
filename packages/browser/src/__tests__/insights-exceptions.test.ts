import { ERROR_TRACKING_SUPPRESSION_RULES, ERROR_TRACKING_CAPTURE_EXTENSION_EXCEPTIONS } from '../constants'
import { defaultConfig, Insights } from '../insights-core'
import { InsightsExceptions } from '../insights-exceptions'
import { InsightsPersistence } from '../insights-persistence'
import {
    ErrorTrackingSuppressionRule,
    ErrorTrackingSuppressionRuleValue,
    InsightsConfig,
    Property,
    RemoteConfig,
} from '../types'

function createSuppressionRule(
    type: 'AND' | 'OR' = 'OR',
    values: ErrorTrackingSuppressionRuleValue[] = [
        {
            key: '$exception_types',
            value: ['TypeError', 'ReactError'],
            operator: 'exact',
            type: 'error_tracking_issue_property',
        },
        {
            key: '$exception_values',
            value: 'ReactMinified',
            operator: 'icontains',
            type: 'error_tracking_issue_property',
        },
    ]
): ErrorTrackingSuppressionRule {
    return { type, values }
}

describe('InsightsExceptions', () => {
    const captureMock = jest.fn()
    let insights: Insights
    let exceptions: InsightsExceptions
    let config: InsightsConfig

    beforeEach(() => {
        config = { ...defaultConfig(), persistence: 'memory' }

        const insightsPersistence = new InsightsPersistence(config)
        insightsPersistence.clear()

        // TODO: we really need to make this a real insights instance :cry:
        insights = {
            get_property: (property_key: string): Property | undefined => {
                return insightsPersistence?.props[property_key]
            },
            config: config,
            capture: captureMock,
            persistence: insightsPersistence,
        } as Partial<Insights> as Insights

        // defaults
        insights.persistence?.register({
            [ERROR_TRACKING_SUPPRESSION_RULES]: [],
        })

        exceptions = new InsightsExceptions(insights)
    })

    afterEach(() => {
        captureMock.mockClear()
    })

    describe('onRemoteConfig', () => {
        it('persists the suppression rules', () => {
            const suppressionRule = createSuppressionRule()
            const remoteResponse: Partial<RemoteConfig> = { errorTracking: { suppressionRules: [suppressionRule] } }
            exceptions.onRemoteConfig(remoteResponse as RemoteConfig)
            expect(exceptions['_suppressionRules']).toEqual([suppressionRule])
        })

        it('does not overwrite persistence when called with empty config', () => {
            const suppressionRule = createSuppressionRule()
            // Set up existing persisted values
            insights.persistence?.register({
                [ERROR_TRACKING_SUPPRESSION_RULES]: [suppressionRule],
                [ERROR_TRACKING_CAPTURE_EXTENSION_EXCEPTIONS]: true,
            })

            // Create new instance to pick up persisted values
            const newExceptions = new InsightsExceptions(insights)

            // Call with empty config (simulating config fetch failure)
            newExceptions.onRemoteConfig({} as RemoteConfig)

            // Should NOT have overwritten the existing values
            expect(insights.persistence!.props[ERROR_TRACKING_SUPPRESSION_RULES]).toEqual([suppressionRule])
            expect(insights.persistence!.props[ERROR_TRACKING_CAPTURE_EXTENSION_EXCEPTIONS]).toBe(true)
        })

        it('updates persistence when errorTracking key is present', () => {
            const suppressionRule = createSuppressionRule()
            insights.persistence?.register({
                [ERROR_TRACKING_SUPPRESSION_RULES]: [suppressionRule],
                [ERROR_TRACKING_CAPTURE_EXTENSION_EXCEPTIONS]: true,
            })

            const newExceptions = new InsightsExceptions(insights)
            newExceptions.onRemoteConfig({
                errorTracking: { suppressionRules: [], captureExtensionExceptions: false },
            } as RemoteConfig)

            expect(insights.persistence!.props[ERROR_TRACKING_SUPPRESSION_RULES]).toEqual([])
            expect(insights.persistence!.props[ERROR_TRACKING_CAPTURE_EXTENSION_EXCEPTIONS]).toBe(false)
        })
    })

    describe('sendExceptionEvent', () => {
        it('captures the event when no suppression rules are provided', () => {
            exceptions.sendExceptionEvent({ custom_property: true })
            expect(captureMock).toBeCalledWith('$exception', { custom_property: true }, expect.anything())
        })

        test.each([
            ['TypeError', 'This is a type error'],
            ['GenericError', 'This is a message that contains a ReactMinified error'],
        ])('drops the event if a suppression rule matches', (type, value) => {
            const suppressionRule = createSuppressionRule('OR')
            exceptions.onRemoteConfig({ errorTracking: { suppressionRules: [suppressionRule] } } as RemoteConfig)
            exceptions.sendExceptionEvent({ $exception_list: [{ type, value }] })
            expect(captureMock).not.toBeCalled()
        })

        it('captures an exception if no $exception_list property exists', () => {
            const suppressionRule = createSuppressionRule('AND')
            exceptions.onRemoteConfig({ errorTracking: { suppressionRules: [suppressionRule] } } as RemoteConfig)
            exceptions.sendExceptionEvent({ custom_property: true })
            expect(captureMock).toBeCalled()
        })

        it('captures an exception if all rule conditions do not match', () => {
            const suppressionRule = createSuppressionRule('AND')
            exceptions.onRemoteConfig({ errorTracking: { suppressionRules: [suppressionRule] } } as RemoteConfig)
            exceptions.sendExceptionEvent({ $exception_list: [{ type: 'TypeError', value: 'This is a type error' }] })
            expect(captureMock).toBeCalled()
        })

        it('captures an exception if there are no targets on the rule', () => {
            const suppressionRule = createSuppressionRule('OR', [
                {
                    key: '$exception_types',
                    value: [],
                    operator: 'exact',
                    type: 'error_tracking_issue_property',
                },
            ])
            exceptions.onRemoteConfig({ errorTracking: { suppressionRules: [suppressionRule] } } as RemoteConfig)
            exceptions.sendExceptionEvent({ $exception_list: [{ type: 'TypeError', value: 'This is a type error' }] })
            expect(captureMock).toBeCalled()
        })

        describe('Extension exceptions', () => {
            it('does not capture exceptions with frames from extensions by default', () => {
                const frame = { filename: 'chrome-extension://', platform: 'javascript:web' }
                const exception = { stacktrace: { frames: [frame], type: 'raw' } }
                exceptions.sendExceptionEvent({ $exception_list: [exception] })
                expect(captureMock).not.toBeCalledWith(
                    '$exception',
                    { $exception_list: [exception] },
                    expect.anything()
                )
            })

            it('captures extension exceptions when enabled', () => {
                exceptions.onRemoteConfig({ errorTracking: { captureExtensionExceptions: true } } as RemoteConfig)
                const frame = { filename: 'chrome-extension://', platform: 'javascript:web' }
                const exception = { stacktrace: { frames: [frame], type: 'raw' } }
                exceptions.sendExceptionEvent({ $exception_list: [exception] })
                expect(captureMock).toBeCalledWith('$exception', { $exception_list: [exception] }, expect.anything())
            })
        })

        describe('Insights SDK exceptions', () => {
            const inAppFrame = {
                filename: '../src/in-app-file.js',
                platform: 'javascript:web',
            }
            const insightsFrame = {
                filename: 'https://internal-t.insights.com/static/array.js',
                platform: 'javascript:web',
            }

            it('does not capture exceptions thrown by the Insights SDK', () => {
                const exception = { stacktrace: { frames: [inAppFrame, insightsFrame], type: 'raw' } }
                exceptions.sendExceptionEvent({ $exception_list: [exception] })
                expect(captureMock).not.toBeCalledWith(
                    '$exception',
                    { $exception_list: [exception] },
                    expect.anything()
                )
            })

            it('captures the exception if a frame from the Insights SDK is not the kaboom frame', () => {
                const exception = { stacktrace: { frames: [insightsFrame, inAppFrame], type: 'raw' } }
                exceptions.sendExceptionEvent({ $exception_list: [exception] })
                expect(captureMock).toBeCalledWith('$exception', { $exception_list: [exception] }, expect.anything())
            })

            it('captures exceptions thrown within the Insights SDK when enabled', () => {
                config.error_tracking.__captureInsightsExceptions = true
                const exception = { stacktrace: { frames: [inAppFrame, insightsFrame], type: 'raw' } }
                exceptions.sendExceptionEvent({ $exception_list: [exception] })
                expect(captureMock).toBeCalledWith('$exception', { $exception_list: [exception] }, expect.anything())
            })
        })
    })
})
