import './helpers/mock-logger'

import { Insights } from '../insights-core'
import { defaultInsights } from './helpers/insights-instance'
import { uuidv7 } from '../uuidv7'

import { isNull } from '@hanzo/insights-core'
import { document, assignableWindow, navigator } from '../utils/globals'
import { InsightsConfig } from '../types'

const DEFAULT_PERSISTENCE_PREFIX = `__ph_opt_in_out_`
const CUSTOM_PERSISTENCE_PREFIX = `𝓶𝓶𝓶𝓬𝓸𝓸𝓴𝓲𝓮𝓼`

function deleteAllCookies() {
    const cookies = document!.cookie.split(';')

    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i]
        const eqPos = cookie.indexOf('=')
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
        document!.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
}

// periodically flakes because of unexpected console logging
jest.retryTimes(3)

describe('consentManager', () => {
    const createInsights = async (config: Partial<InsightsConfig> = {}) => {
        const insights = await new Promise<Insights>(
            (resolve) =>
                defaultInsights().init('testtoken', { ...config, loaded: (insights) => resolve(insights) }, uuidv7())!
        )
        insights.debug()
        return insights
    }

    let insights: Insights

    beforeEach(async () => {
        insights = await createInsights()
        insights.reset()

        // we don't want unexpected console errors/warnings to fail these tests
        console.error = jest.fn()
        console.warn = jest.fn()
    })

    afterEach(() => {
        document!.getElementsByTagName('html')[0].innerHTML = ''
        assignableWindow.localStorage.clear()
        deleteAllCookies()
    })

    it('should start default opted in', () => {
        expect(insights.has_opted_in_capturing()).toBe(true)
        expect(insights.has_opted_out_capturing()).toBe(false)
        expect(insights.get_explicit_consent_status()).toBe('pending')

        expect(insights.persistence?._disabled).toBe(false)
        expect(insights.sessionPersistence?._disabled).toBe(false)
    })

    it('should start default opted out if setting given', async () => {
        insights = await createInsights({ opt_out_capturing_by_default: true })
        expect(insights.has_opted_in_capturing()).toBe(false)
        expect(insights.has_opted_out_capturing()).toBe(true)
        expect(insights.get_explicit_consent_status()).toBe('pending')

        expect(insights.persistence?._disabled).toBe(false)
        expect(insights.sessionPersistence?._disabled).toBe(false)
    })

    it('should start default opted out if setting given and disable storage', async () => {
        insights = await createInsights({ opt_out_capturing_by_default: true, opt_out_persistence_by_default: true })
        expect(insights.has_opted_in_capturing()).toBe(false)
        expect(insights.has_opted_out_capturing()).toBe(true)
        expect(insights.get_explicit_consent_status()).toBe('pending')

        expect(insights.persistence?._disabled).toBe(true)
        expect(insights.sessionPersistence?._disabled).toBe(true)
    })

    it('should enable or disable persistence when changing opt out status', async () => {
        insights = await createInsights({ opt_out_capturing_by_default: true, opt_out_persistence_by_default: true })
        expect(insights.has_opted_in_capturing()).toBe(false)
        expect(insights.persistence?._disabled).toBe(true)
        expect(insights.get_explicit_consent_status()).toBe('pending')

        insights.opt_in_capturing()
        expect(insights.has_opted_in_capturing()).toBe(true)
        expect(insights.persistence?._disabled).toBe(false)
        expect(insights.get_explicit_consent_status()).toBe('granted')

        insights.opt_out_capturing()
        expect(insights.has_opted_in_capturing()).toBe(false)
        expect(insights.persistence?._disabled).toBe(true)
        expect(insights.get_explicit_consent_status()).toBe('denied')
    })

    describe('opt out event', () => {
        let beforeSendMock = jest.fn().mockImplementation((...args) => args)
        beforeEach(async () => {
            beforeSendMock = jest.fn().mockImplementation((e) => e)
            insights = await createInsights({ opt_out_capturing_by_default: true, before_send: beforeSendMock })
        })

        it('should send opt in event if not disabled', () => {
            insights.opt_in_capturing()
            expect(beforeSendMock).toHaveBeenCalledWith(expect.objectContaining({ event: '$opt_in' }))
        })

        it('should send opt in event with overrides', () => {
            insights.opt_in_capturing({
                captureEventName: 'override-opt-in',
                captureProperties: {
                    foo: 'bar',
                },
            })
            expect(beforeSendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'override-opt-in',
                    properties: expect.objectContaining({
                        foo: 'bar',
                    }),
                })
            )
        })

        it('should not send opt in event if false', () => {
            insights.opt_in_capturing({ captureEventName: false })
            expect(beforeSendMock).toHaveBeenCalledTimes(1)
            expect(beforeSendMock).not.toHaveBeenCalledWith(expect.objectContaining({ event: '$opt_in' }))
            expect(beforeSendMock).lastCalledWith(expect.objectContaining({ event: '$pageview' }))
        })

        it('should not send opt in event if false', () => {
            insights.opt_in_capturing({ captureEventName: false })
            expect(beforeSendMock).toHaveBeenCalledTimes(1)
            expect(beforeSendMock).not.toHaveBeenCalledWith(expect.objectContaining({ event: '$opt_in' }))
            expect(beforeSendMock).lastCalledWith(expect.objectContaining({ event: '$pageview' }))
        })

        it('should not send $pageview on opt in if capturing is disabled', async () => {
            insights = await createInsights({
                opt_out_capturing_by_default: true,
                before_send: beforeSendMock,
                capture_pageview: false,
            })
            insights.opt_in_capturing({ captureEventName: false })
            expect(beforeSendMock).toHaveBeenCalledTimes(0)
        })

        it('should not send $pageview on opt in if is has already been captured', async () => {
            insights = await createInsights({
                before_send: beforeSendMock,
            })
            // Wait for the initial $pageview to be captured
            // eslint-disable-next-line compat/compat
            await new Promise((r) => setTimeout(r, 10))
            expect(beforeSendMock).toHaveBeenCalledTimes(1)
            expect(beforeSendMock).lastCalledWith(expect.objectContaining({ event: '$pageview' }))
            insights.opt_in_capturing()
            expect(beforeSendMock).toHaveBeenCalledTimes(2)
            expect(beforeSendMock).toHaveBeenCalledWith(expect.objectContaining({ event: '$opt_in' }))
        })

        it('should send $pageview on opt in if is has not been captured', async () => {
            // Some other tests might call setTimeout after they've passed, so creating a new instance here.
            const beforeSendMock = jest.fn().mockImplementation((e) => e)
            const insights = await createInsights({ before_send: beforeSendMock })

            insights.opt_in_capturing()
            expect(beforeSendMock).toHaveBeenCalledTimes(2)
            expect(beforeSendMock).toHaveBeenCalledWith(expect.objectContaining({ event: '$opt_in' }))
            expect(beforeSendMock).lastCalledWith(expect.objectContaining({ event: '$pageview' }))
            // Wait for the $pageview timeout to be called
            // eslint-disable-next-line compat/compat
            await new Promise((r) => setTimeout(r, 10))
            expect(beforeSendMock).toHaveBeenCalledTimes(2)
        })

        it('should not send $pageview on subsequent opt in', async () => {
            // Some other tests might call setTimeout after they've passed, so creating a new instance here.
            const beforeSendMock = jest.fn().mockImplementation((e) => e)
            const insights = await createInsights({ before_send: beforeSendMock })

            insights.opt_in_capturing()
            expect(beforeSendMock).toHaveBeenCalledTimes(2)
            expect(beforeSendMock).toHaveBeenCalledWith(expect.objectContaining({ event: '$opt_in' }))
            expect(beforeSendMock).lastCalledWith(expect.objectContaining({ event: '$pageview' }))
            // Wait for the $pageview timeout to be called
            // eslint-disable-next-line compat/compat
            await new Promise((r) => setTimeout(r, 10))
            insights.opt_in_capturing()
            expect(beforeSendMock).toHaveBeenCalledTimes(3)
            expect(beforeSendMock).not.lastCalledWith(expect.objectContaining({ event: '$pageview' }))
        })
    })

    describe('with do not track setting', () => {
        beforeEach(() => {
            ;(navigator as any).doNotTrack = '1'
        })

        it('should respect it if explicitly set', async () => {
            insights = await createInsights({ respect_dnt: true })
            expect(insights.has_opted_in_capturing()).toBe(false)
        })

        it('should not respect it if not explicitly set', () => {
            expect(insights.has_opted_in_capturing()).toBe(true)
        })
    })

    describe.each([`cookie`, `localStorage`] as InsightsConfig['opt_out_capturing_persistence_type'][])(
        `%s`,
        (persistenceType) => {
            function assertPersistenceValue(
                value: string | number | null,
                persistencePrefix = DEFAULT_PERSISTENCE_PREFIX
            ) {
                const token = insights.config.token
                const expected = persistencePrefix + token
                if (persistenceType === `cookie`) {
                    if (isNull(value)) {
                        expect(document!.cookie).not.toContain(expected + `=`)
                    } else {
                        expect(document!.cookie).toContain(expected + `=${value}`)
                    }
                } else {
                    if (isNull(value)) {
                        expect(assignableWindow.localStorage.getItem(expected)).toBeNull()
                    } else {
                        expect(assignableWindow.localStorage.getItem(expected)).toBe(`${value}`)
                    }
                }
            }

            beforeEach(async () => {
                insights = await createInsights({
                    opt_out_capturing_persistence_type: persistenceType,
                    persistence: persistenceType,
                })
            })

            describe(`common consent functions`, () => {
                it(`should set a persistent value marking the user as opted-in for a given token`, () => {
                    insights.opt_in_capturing()
                    assertPersistenceValue(1)
                })

                it(`should set a persistent value marking the user as opted-out for a given token`, () => {
                    insights.opt_out_capturing()
                    assertPersistenceValue(0)
                })

                it(`should capture an event recording the opt-in action`, () => {
                    const beforeSendMock = jest.fn()
                    insights.on('eventCaptured', beforeSendMock)

                    insights.opt_in_capturing()
                    expect(beforeSendMock).toHaveBeenCalledWith(expect.objectContaining({ event: '$opt_in' }))

                    beforeSendMock.mockClear()
                    const captureEventName = `єνєηт`
                    const captureProperties = { '𝖕𝖗𝖔𝖕𝖊𝖗𝖙𝖞': `𝓿𝓪𝓵𝓾𝓮` }

                    insights.opt_in_capturing({ captureEventName, captureProperties })
                    expect(beforeSendMock).toHaveBeenCalledWith(
                        expect.objectContaining({
                            event: captureEventName,
                            properties: expect.objectContaining(captureProperties),
                        })
                    )
                })

                it(`should allow use of a custom "persistence prefix" string (with correct default behavior)`, async () => {
                    insights = await createInsights({
                        opt_out_capturing_persistence_type: persistenceType,
                        opt_out_capturing_cookie_prefix: CUSTOM_PERSISTENCE_PREFIX,
                    })
                    insights.opt_out_capturing()
                    insights.opt_in_capturing()

                    assertPersistenceValue(null)
                    assertPersistenceValue(1, CUSTOM_PERSISTENCE_PREFIX)

                    insights.opt_out_capturing()

                    assertPersistenceValue(null)
                    assertPersistenceValue(0, CUSTOM_PERSISTENCE_PREFIX)
                })

                it(`should clear the persisted value`, () => {
                    insights.opt_in_capturing()
                    assertPersistenceValue(1)
                    insights.reset()
                    assertPersistenceValue(null)
                })
            })
        }
    )
})
