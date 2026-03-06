import { defaultInsights } from './helpers/insights-instance'
import type { InsightsConfig } from '../types'
import { uuidv7 } from '../uuidv7'
import { SurveyEventName, SurveyEventProperties } from '../insights-surveys-types'
import { ProductTourEventName, ProductTourEventProperties } from '../insights-product-tours-types'
import { SURVEY_SEEN_PREFIX } from '../utils/survey-utils'
import { beforeEach } from '@jest/globals'

jest.mock('../utils/globals', () => {
    const orig = jest.requireActual('../utils/globals')
    const mockURL = jest.fn().mockReturnValue('https://example.com')
    const mockReferrer = jest.fn().mockReturnValue('https://referrer.com')
    const mockHostName = jest.fn().mockReturnValue('example.com')
    return {
        ...orig,
        mockURL,
        mockReferrer,
        mockHostName,
        document: {
            ...orig.document,
            createElement: (...args: any[]) => orig.document.createElement(...args),
            get referrer() {
                return mockReferrer()
            },
            get URL() {
                return mockURL()
            },
        },
        get location() {
            return {
                href: mockURL(),
                toString: () => mockURL(),
                hostname: mockHostName(),
            }
        },
    }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mockURL, mockReferrer, mockHostName } = require('../utils/globals')

describe('insights core', () => {
    beforeEach(() => {
        mockReferrer.mockReturnValue('https://referrer.com')
        mockURL.mockReturnValue('https://example.com')
        mockHostName.mockReturnValue('example.com')
        // otherwise surveys code logs an error and fails the test
        console.error = jest.fn()
    })

    it('exposes the version', () => {
        expect(defaultInsights().version).toMatch(/\d+\.\d+\.\d+/)
    })

    describe('insights debug logging', () => {
        beforeEach(() => {
            console.error = jest.fn()
            console.log = jest.fn()
            console.warn = jest.fn()
        })

        it('log when setting debug to false', () => {
            const insights = defaultInsights().init(uuidv7(), { debug: false })!
            insights.debug(false)
            expect(console.error).not.toHaveBeenCalled()
            expect(console.warn).not.toHaveBeenCalled()
            expect(console.log).toHaveBeenCalledWith("You've disabled debug mode.")
        })

        it('log when setting debug to undefined', () => {
            const insights = defaultInsights().init(uuidv7(), { debug: false })!
            insights.debug()
            expect(console.log).toHaveBeenCalledWith(
                "You're now in debug mode. All calls to Insights will be logged in your console.\nYou can disable this with `insights.debug(false)`."
            )
        })

        it('log when setting debug to true', () => {
            const insights = defaultInsights().init(uuidv7(), { debug: false })!
            insights.debug(true)
            expect(console.log).toHaveBeenCalledWith(
                "You're now in debug mode. All calls to Insights will be logged in your console.\nYou can disable this with `insights.debug(false)`."
            )
        })
    })

    describe('capture()', () => {
        const eventName = 'custom_event'
        const eventProperties = {
            event: 'prop',
        }
        const setup = (config: Partial<InsightsConfig> = {}, token: string = uuidv7()) => {
            const beforeSendMock = jest.fn().mockImplementation((e) => e)
            const insights = defaultInsights().init(token, { ...config, before_send: beforeSendMock }, token)!
            insights.debug()
            return { insights, beforeSendMock }
        }

        it('respects property_denylist and property_blacklist', () => {
            // arrange
            const { insights } = setup({
                property_denylist: ['$lib', 'persistent', '$is_identified'],
                property_blacklist: ['token'],
            })

            // act
            const actual = insights.calculateEventProperties(eventName, eventProperties, new Date())

            // assert
            expect(actual['event']).toBe('prop')
            expect(actual['$lib']).toBeUndefined()
            expect(actual['persistent']).toBeUndefined()
            expect(actual['$is_identified']).toBeUndefined()
            expect(actual['token']).toBeUndefined()
        })

        describe('rate limiting', () => {
            it('includes information about remaining rate limit', () => {
                const { insights, beforeSendMock } = setup()

                insights.capture(eventName, eventProperties)

                expect(beforeSendMock.mock.calls[0][0]).toMatchObject({
                    properties: {
                        $lib_rate_limit_remaining_tokens: 99,
                    },
                })
            })

            it('does not capture if rate limit is in place', () => {
                jest.useFakeTimers()
                jest.setSystemTime(Date.now())

                console.error = jest.fn()
                const { insights, beforeSendMock } = setup()
                for (let i = 0; i < 100; i++) {
                    insights.capture(eventName, eventProperties)
                }
                expect(beforeSendMock).toHaveBeenCalledTimes(100)
                beforeSendMock.mockClear()
                ;(console.error as any).mockClear()
                for (let i = 0; i < 50; i++) {
                    insights.capture(eventName, eventProperties)
                }
                expect(beforeSendMock).toHaveBeenCalledTimes(1)
                expect(beforeSendMock.mock.calls[0][0].event).toBe('$$client_ingestion_warning')
                expect(console.error).toHaveBeenCalledTimes(50)
                expect(console.error).toHaveBeenCalledWith(
                    '[Insights.js]',
                    'This capture call is ignored due to client rate limiting.'
                )
            })
        })

        describe('referrer', () => {
            it("should send referrer info with the event's properties", () => {
                // arrange
                const token = uuidv7()
                mockReferrer.mockReturnValue('https://referrer.example.com/some/path')
                const { insights, beforeSendMock } = setup({
                    token,
                    persistence_name: token,
                    person_profiles: 'always',
                })

                // act
                insights.capture(eventName, eventProperties)

                // assert
                const { $set_once, properties } = beforeSendMock.mock.calls[0][0]
                expect($set_once['$initial_referrer']).toBe('https://referrer.example.com/some/path')
                expect($set_once['$initial_referring_domain']).toBe('referrer.example.com')
                expect(properties['$referrer']).toBe('https://referrer.example.com/some/path')
                expect(properties['$referring_domain']).toBe('referrer.example.com')
            })

            it('should not update the referrer within the same session', () => {
                // arrange
                const token = uuidv7()
                mockReferrer.mockReturnValue('https://referrer1.example.com/some/path')
                const { insights: insights1 } = setup({
                    token,
                    persistence_name: token,
                    person_profiles: 'always',
                })
                insights1.capture(eventName, eventProperties)
                mockReferrer.mockReturnValue('https://referrer2.example.com/some/path')
                const { insights: insights2, beforeSendMock } = setup({
                    token,
                    persistence_name: token,
                })

                // act
                insights2.capture(eventName, eventProperties)

                // assert
                expect(insights2.persistence!.props.$initial_person_info.r).toEqual(
                    'https://referrer1.example.com/some/path'
                )
                expect(insights2.sessionPersistence!.props.$referrer).toEqual('https://referrer1.example.com/some/path')
                const { $set_once, properties } = beforeSendMock.mock.calls[0][0]
                expect($set_once['$initial_referrer']).toBe('https://referrer1.example.com/some/path')
                expect($set_once['$initial_referring_domain']).toBe('referrer1.example.com')
                expect(properties['$referrer']).toBe('https://referrer1.example.com/some/path')
                expect(properties['$referring_domain']).toBe('referrer1.example.com')
            })

            it('should use the new referrer in a new session', () => {
                // arrange
                const token = uuidv7()
                mockReferrer.mockReturnValue('https://referrer1.example.com/some/path')
                const { insights: insights1 } = setup({
                    token,
                    persistence_name: token,
                    person_profiles: 'always',
                })
                insights1.capture(eventName, eventProperties)
                mockReferrer.mockReturnValue('https://referrer2.example.com/some/path')
                const { insights: insights2, beforeSendMock: beforeSendMock2 } = setup({
                    token,
                    persistence_name: token,
                })
                insights2.sessionPersistence!.clear() // simulate a new session

                // act
                insights2.capture(eventName, eventProperties)

                // assert
                expect(insights2.persistence!.props.$initial_person_info.r).toEqual(
                    'https://referrer1.example.com/some/path'
                )
                const { $set_once, properties } = beforeSendMock2.mock.calls[0][0]
                expect($set_once['$initial_referrer']).toBe('https://referrer1.example.com/some/path')
                expect($set_once['$initial_referring_domain']).toBe('referrer1.example.com')
                expect(properties['$referrer']).toBe('https://referrer2.example.com/some/path')
                expect(properties['$referring_domain']).toBe('referrer2.example.com')
            })

            it('should use $direct when there is no referrer', () => {
                // arrange
                const token = uuidv7()
                mockReferrer.mockReturnValue('')
                const { insights, beforeSendMock } = setup({
                    token,
                    persistence_name: token,
                    person_profiles: 'always',
                })

                // act
                insights.capture(eventName, eventProperties)

                // assert
                const { $set_once, properties } = beforeSendMock.mock.calls[0][0]
                expect($set_once['$initial_referrer']).toBe('$direct')
                expect($set_once['$initial_referring_domain']).toBe('$direct')
                expect(properties['$referrer']).toBe('$direct')
                expect(properties['$referring_domain']).toBe('$direct')
            })
        })

        describe('campaign params', () => {
            it('should not send campaign params as null if there are no non-null ones', () => {
                // arrange
                const token = uuidv7()
                mockURL.mockReturnValue('https://www.example.com/some/path')
                const { insights, beforeSendMock } = setup({
                    token,
                    persistence_name: token,
                })

                // act
                insights.capture('$pageview')

                //assert
                expect(beforeSendMock.mock.calls[0][0].properties).not.toHaveProperty('utm_source')
                expect(beforeSendMock.mock.calls[0][0].properties).not.toHaveProperty('utm_medium')
            })

            it('should send present campaign params, and nulls for others', () => {
                // arrange
                const token = uuidv7()
                mockURL.mockReturnValue('https://www.example.com/some/path?utm_source=source')
                const { insights, beforeSendMock } = setup({
                    token,
                    persistence_name: token,
                })

                // act
                insights.capture('$pageview')

                //assert
                expect(beforeSendMock.mock.calls[0][0].properties.utm_source).toBe('source')
                expect(beforeSendMock.mock.calls[0][0].properties.utm_medium).toBe(null)
            })
        })

        describe('survey events', () => {
            it('sending survey sent events should mark it as seen in localStorage and set the interaction property', () => {
                // arrange
                const { insights, beforeSendMock } = setup({ debug: false })
                const survey = {
                    id: 'testSurvey1',
                    current_iteration: 1,
                }
                const surveySeenKey = `${SURVEY_SEEN_PREFIX}${survey.id}_${survey.current_iteration}`

                // act
                insights.capture(SurveyEventName.SENT, {
                    [SurveyEventProperties.SURVEY_ID]: survey.id,
                    [SurveyEventProperties.SURVEY_ITERATION]: survey.current_iteration,
                })

                // assert
                expect(localStorage.getItem(surveySeenKey)).toBe('true')
                // test if property contains at least $set but dont care about the other properties
                expect(beforeSendMock.mock.calls[0][0]).toMatchObject({
                    properties: {
                        [SurveyEventProperties.SURVEY_ID]: survey.id,
                        [SurveyEventProperties.SURVEY_ITERATION]: survey.current_iteration,
                    },
                    $set: {
                        '$survey_responded/testSurvey1/1': true,
                    },
                })
            })
            it('sending survey dismissed events should mark it as seen in localStorage and set the interaction property', () => {
                // arrange
                const { insights, beforeSendMock } = setup({ debug: false })
                const survey = {
                    id: 'testSurvey1',
                    current_iteration: 1,
                }
                const surveySeenKey = `${SURVEY_SEEN_PREFIX}${survey.id}_${survey.current_iteration}`

                // act
                insights.capture(SurveyEventName.DISMISSED, {
                    [SurveyEventProperties.SURVEY_ID]: survey.id,
                    [SurveyEventProperties.SURVEY_ITERATION]: survey.current_iteration,
                })

                // assert
                expect(localStorage.getItem(surveySeenKey)).toBe('true')
                // test if property contains at least $set but dont care about the other properties
                expect(beforeSendMock.mock.calls[0][0]).toMatchObject({
                    properties: {
                        [SurveyEventProperties.SURVEY_ID]: survey.id,
                        [SurveyEventProperties.SURVEY_ITERATION]: survey.current_iteration,
                    },
                    $set: {
                        '$survey_dismissed/testSurvey1/1': true,
                    },
                })
            })
            it('sending survey shown events should set the last seen survey date property', () => {
                // arrange
                const { insights, beforeSendMock } = setup({ debug: false })
                const survey = {
                    id: 'testSurvey1',
                    current_iteration: 1,
                }

                // act
                insights.capture(SurveyEventName.SHOWN, {
                    [SurveyEventProperties.SURVEY_ID]: survey.id,
                    [SurveyEventProperties.SURVEY_ITERATION]: survey.current_iteration,
                })

                // assert
                const capturedEvent = beforeSendMock.mock.calls[0][0]
                expect(capturedEvent.$set).toBeDefined()
                expect(capturedEvent.$set[SurveyEventProperties.SURVEY_LAST_SEEN_DATE]).toBeDefined()
                // Verify it's a valid ISO date string
                expect(new Date(capturedEvent.$set[SurveyEventProperties.SURVEY_LAST_SEEN_DATE]).toISOString()).toBe(
                    capturedEvent.$set[SurveyEventProperties.SURVEY_LAST_SEEN_DATE]
                )
            })
        })
    })

    describe('product tour capture()', () => {
        const setup = (config: Partial<InsightsConfig> = {}, token: string = uuidv7()) => {
            const beforeSendMock = jest.fn().mockImplementation((e) => e)
            const insights = defaultInsights().init(token, { ...config, before_send: beforeSendMock }, token)!
            return { insights, beforeSendMock }
        }

        it('sending product tour shown events with tour_type should set type-specific last seen date property', () => {
            // arrange
            const { insights, beforeSendMock } = setup({ debug: false })

            // act
            insights.capture(ProductTourEventName.SHOWN, {
                [ProductTourEventProperties.TOUR_ID]: 'testTour1',
                [ProductTourEventProperties.TOUR_NAME]: 'Test Tour',
                [ProductTourEventProperties.TOUR_TYPE]: 'tour',
            })

            // assert
            const capturedEvent = beforeSendMock.mock.calls[0][0]
            expect(capturedEvent.$set).toBeDefined()
            const typeSpecificKey = `${ProductTourEventProperties.TOUR_LAST_SEEN_DATE}/tour`
            expect(capturedEvent.$set[typeSpecificKey]).toBeDefined()
            // Verify it's a valid ISO date string
            expect(new Date(capturedEvent.$set[typeSpecificKey]).toISOString()).toBe(
                capturedEvent.$set[typeSpecificKey]
            )
        })

        it('sending product tour shown events without tour_type should not set last seen date property', () => {
            // arrange
            const { insights, beforeSendMock } = setup({ debug: false })

            // act
            insights.capture(ProductTourEventName.SHOWN, {
                [ProductTourEventProperties.TOUR_ID]: 'testTour1',
                [ProductTourEventProperties.TOUR_NAME]: 'Test Tour',
            })

            // assert
            const capturedEvent = beforeSendMock.mock.calls[0][0]
            // No $set should be added when tour_type is missing
            expect(capturedEvent.$set).toBeUndefined()
        })
    })

    describe('setInternalOrTestUser()', () => {
        const setup = (config: Partial<InsightsConfig> = {}, token: string = uuidv7()) => {
            const beforeSendMock = jest.fn().mockImplementation((e) => e)
            const insights = defaultInsights().init(token, { ...config, before_send: beforeSendMock }, token)!
            return { insights, beforeSendMock }
        }

        it('should set $internal_or_test_user person property to true', () => {
            const { insights, beforeSendMock } = setup({ person_profiles: 'always' })

            insights.setInternalOrTestUser()

            expect(beforeSendMock).toHaveBeenCalledTimes(1)
            const call = beforeSendMock.mock.calls[0][0]
            expect(call.event).toEqual('$set')
            expect(call.properties.$set).toEqual({ $internal_or_test_user: true })
        })

        it('should enable person processing when called in identified_only mode', () => {
            const { insights, beforeSendMock } = setup({ person_profiles: 'identified_only' })

            insights.capture('event before setInternalOrTestUser')
            insights.setInternalOrTestUser()
            insights.capture('event after setInternalOrTestUser')

            expect(beforeSendMock).toHaveBeenCalledTimes(3)

            const eventBefore = beforeSendMock.mock.calls[0][0]
            expect(eventBefore.properties.$process_person_profile).toEqual(false)

            const setInternalOrTestUserEvent = beforeSendMock.mock.calls[1][0]
            expect(setInternalOrTestUserEvent.event).toEqual('$set')
            expect(setInternalOrTestUserEvent.properties.$process_person_profile).toEqual(true)

            const eventAfter = beforeSendMock.mock.calls[2][0]
            expect(eventAfter.properties.$process_person_profile).toEqual(true)
        })

        it('should not send duplicate events when called multiple times', () => {
            const { insights, beforeSendMock } = setup({ person_profiles: 'always' })

            insights.setInternalOrTestUser()
            insights.setInternalOrTestUser()

            expect(beforeSendMock).toHaveBeenCalledTimes(1)
        })

        describe('internal_or_test_user_hostname config', () => {
            it('should call setInternalOrTestUser automatically when hostname matches regex', async () => {
                mockHostName.mockReturnValue('localhost')
                const { beforeSendMock } = setup({
                    person_profiles: 'identified_only',
                    internal_or_test_user_hostname: /^(localhost|127\.0\.0\.1)$/,
                })

                const setEvents = beforeSendMock.mock.calls.filter((call) => call[0].event === '$set')
                expect(setEvents.length).toEqual(1)
                expect(setEvents[0][0].properties.$set).toEqual({ $internal_or_test_user: true })
            })

            it('should work with string exact match', () => {
                mockHostName.mockReturnValue('localhost')
                const { beforeSendMock } = setup({
                    person_profiles: 'identified_only',
                    internal_or_test_user_hostname: 'localhost',
                })

                const setEvents = beforeSendMock.mock.calls.filter((call) => call[0].event === '$set')
                expect(setEvents.length).toEqual(1)
            })

            it('should not match partial strings', () => {
                mockHostName.mockReturnValue('localhost.example.com')
                const { beforeSendMock } = setup({
                    person_profiles: 'identified_only',
                    internal_or_test_user_hostname: 'localhost',
                })

                const setEvents = beforeSendMock.mock.calls.filter((call) => call[0].event === '$set')
                expect(setEvents.length).toEqual(0)
            })

            it('should not call setInternalOrTestUser when hostname does not match', () => {
                mockHostName.mockReturnValue('production.example.com')
                const { beforeSendMock } = setup({
                    person_profiles: 'identified_only',
                    internal_or_test_user_hostname: /^localhost$/,
                })

                const setEvents = beforeSendMock.mock.calls.filter((call) => call[0].event === '$set')
                expect(setEvents.length).toEqual(0)
            })

            it('should allow disabling with null', () => {
                mockHostName.mockReturnValue('localhost')
                const { insights, beforeSendMock } = setup({
                    person_profiles: 'identified_only',
                    defaults: '2026-01-30',
                    internal_or_test_user_hostname: null,
                })

                expect(insights.config.internal_or_test_user_hostname).toBeNull()
                const setEvents = beforeSendMock.mock.calls.filter((call) => call[0].event === '$set')
                expect(setEvents.length).toEqual(0)
            })
        })
    })

    describe('_execute_array and push re-entrancy guard', () => {
        it('should not infinitely recurse when push is called re-entrantly (e.g., TikTok Proxy)', () => {
            const insights = defaultInsights()

            // Simulate TikTok's in-app browser Proxy behavior:
            // When _execute_array dispatches a method via this[method](),
            // a Proxy intercepts it and calls push() instead, which would
            // re-enter _execute_array and cause infinite recursion.
            const origCapture = insights.capture.bind(insights)
            let callCount = 0
            insights.capture = function (...args: any[]) {
                callCount++
                if (callCount > 100) {
                    throw new Error('Infinite recursion detected')
                }
                // Simulate what TikTok's Proxy does: convert the method call
                // to a push() call
                insights.push(['capture', ...args])
            } as any

            // This should not throw RangeError: Maximum call stack size exceeded
            expect(() => {
                insights.push(['capture', 'test-event', { foo: 'bar' }])
            }).not.toThrow()

            // Restore original capture to verify it was called via prototype
            insights.capture = origCapture
        })

        it('should execute methods normally when no Proxy interference', () => {
            const insights = defaultInsights()
            const captureSpy = jest.spyOn(insights, 'capture').mockImplementation()

            insights.push(['capture', 'test-event', { foo: 'bar' }])

            expect(captureSpy).toHaveBeenCalledWith('test-event', { foo: 'bar' })
            captureSpy.mockRestore()
        })

        it('should handle _execute_array with array of commands', () => {
            const insights = defaultInsights()
            const registerSpy = jest.spyOn(insights, 'register').mockImplementation()
            const captureSpy = jest.spyOn(insights, 'capture').mockImplementation()

            insights._execute_array([
                ['register', { key: 'value' }],
                ['capture', 'test-event'],
            ])

            expect(registerSpy).toHaveBeenCalledWith({ key: 'value' })
            expect(captureSpy).toHaveBeenCalledWith('test-event')
            registerSpy.mockRestore()
            captureSpy.mockRestore()
        })
    })
})
