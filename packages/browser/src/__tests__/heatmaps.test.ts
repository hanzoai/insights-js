import './helpers/mock-logger'

import { createInsightsInstance } from './helpers/insights-instance'
import { uuidv7 } from '../uuidv7'
import { Insights } from '../insights-core'
import { FlagsResponse } from '../types'
import { isObject } from '@hanzo/insights-core'
import { beforeEach, expect } from '@jest/globals'
import { HEATMAPS_ENABLED_SERVER_SIDE } from '../constants'
import { Heatmaps } from '../heatmaps'

jest.useFakeTimers()

describe('heatmaps', () => {
    let insights: Insights
    let beforeSendMock = jest.fn().mockImplementation((e) => e)

    const createMockMouseEvent = (props: Partial<MouseEvent> = {}) =>
        ({
            target: document.body,
            clientX: 10,
            clientY: 20,
            ...props,
        }) as unknown as MouseEvent

    beforeEach(async () => {
        beforeSendMock = beforeSendMock.mockClear()

        insights = await createInsightsInstance(uuidv7(), {
            before_send: beforeSendMock,
            sanitize_properties: (props) => {
                // what ever sanitization makes sense
                const sanitizeUrl = (url: string) => url.replace(/https?:\/\/[^/]+/g, 'http://replaced')
                if (props['$current_url']) {
                    props['$current_url'] = sanitizeUrl(props['$current_url'])
                }
                if (isObject(props['$heatmap_data'])) {
                    // the keys of the heatmap data are URLs, so we might need to sanitize them to
                    // this sanitized URL would need to be entered in the toolbar for the heatmap display to work
                    props['$heatmap_data'] = Object.entries(props['$heatmap_data']).reduce((acc, [url, data]) => {
                        acc[sanitizeUrl(url)] = data
                        return acc
                    }, {})
                }
                return props
            },
            // simplifies assertions by not needing to ignore events
            capture_pageview: false,
        })

        insights.config.capture_heatmaps = true

        // make sure we start fresh
        insights.heatmaps!.startIfEnabled()
        expect(insights.heatmaps!.getAndClearBuffer()).toBeUndefined()

        insights.register({ $current_test_name: expect.getState().currentTestName })
    })

    it('should send generated heatmap data', async () => {
        insights.heatmaps?.['_onClick']?.(createMockMouseEvent())

        jest.advanceTimersByTime(insights.heatmaps!.flushIntervalMilliseconds + 1)

        expect(beforeSendMock).toBeCalledTimes(1)
        expect(beforeSendMock.mock.lastCall[0]).toMatchObject({
            event: '$$heatmap',
            properties: {
                $heatmap_data: {
                    'http://replaced/': [
                        {
                            target_fixed: false,
                            type: 'click',
                            x: 10,
                            y: 20,
                        },
                    ],
                },
            },
        })
    })

    it('should flush on window unload', async () => {
        insights.heatmaps?.['_onClick']?.(createMockMouseEvent())

        window.dispatchEvent(new Event('beforeunload'))

        expect(beforeSendMock).toBeCalledTimes(1)
        expect(beforeSendMock.mock.lastCall[0]).toMatchObject({
            event: '$$heatmap',
            properties: {
                $heatmap_data: {
                    'http://replaced/': [
                        {
                            target_fixed: false,
                            type: 'click',
                            x: 10,
                            y: 20,
                        },
                    ],
                },
            },
        })
    })

    it('requires interval to pass before sending data', async () => {
        insights.heatmaps?.['_onClick']?.(createMockMouseEvent())

        jest.advanceTimersByTime(insights.heatmaps!.flushIntervalMilliseconds - 1)

        expect(beforeSendMock).toBeCalledTimes(0)
        expect(insights.heatmaps!.getAndClearBuffer()).toBeDefined()
    })

    it('should handle empty mouse moves', async () => {
        insights.heatmaps?.['_onMouseMove']?.(new Event('mousemove'))

        jest.advanceTimersByTime(insights.heatmaps!.flushIntervalMilliseconds + 1)

        expect(beforeSendMock).toBeCalledTimes(0)
    })

    it('should send rageclick events in the same area', async () => {
        insights.heatmaps?.['_onClick']?.(createMockMouseEvent())
        insights.heatmaps?.['_onClick']?.(createMockMouseEvent())
        insights.heatmaps?.['_onClick']?.(createMockMouseEvent())

        jest.advanceTimersByTime(insights.heatmaps!.flushIntervalMilliseconds + 1)

        expect(beforeSendMock).toBeCalledTimes(1)
        expect(beforeSendMock.mock.lastCall[0].event).toEqual('$$heatmap')
        const heatmapData = beforeSendMock.mock.lastCall[0].properties.$heatmap_data
        expect(heatmapData).toBeDefined()
        expect(heatmapData['http://replaced/']).toHaveLength(4)
        expect(heatmapData['http://replaced/'].map((x) => x.type)).toEqual(['click', 'click', 'rageclick', 'click'])
    })

    it('should clear the buffer after each call', async () => {
        insights.heatmaps?.['_onClick']?.(createMockMouseEvent())
        insights.heatmaps?.['_onClick']?.(createMockMouseEvent())

        jest.advanceTimersByTime(insights.heatmaps!.flushIntervalMilliseconds + 1)

        expect(beforeSendMock).toBeCalledTimes(1)
        expect(beforeSendMock.mock.lastCall[0].event).toEqual('$$heatmap')
        expect(beforeSendMock.mock.lastCall[0].properties.$heatmap_data).toBeDefined()
        expect(beforeSendMock.mock.lastCall[0].properties.$heatmap_data['http://replaced/']).toHaveLength(2)

        expect(insights.heatmaps!['buffer']).toEqual(undefined)

        jest.advanceTimersByTime(insights.heatmaps!.flushIntervalMilliseconds + 1)

        expect(beforeSendMock).toBeCalledTimes(1)
    })

    it('should ignore clicks if they come from the toolbar', async () => {
        const testElementToolbar = document.createElement('div')
        testElementToolbar.id = '__INSIGHTS_TOOLBAR__'

        insights.heatmaps?.['_onClick']?.(
            createMockMouseEvent({
                target: testElementToolbar,
            })
        )
        expect(insights.heatmaps?.['buffer']).toEqual(undefined)

        const testElementClosest = document.createElement('div')
        testElementClosest.closest = () => {
            return {}
        }

        insights.heatmaps?.['_onClick']?.(
            createMockMouseEvent({
                target: testElementClosest,
            })
        )
        expect(insights.heatmaps?.['buffer']).toEqual(undefined)

        insights.heatmaps?.['_onClick']?.(
            createMockMouseEvent({
                target: document.body,
            })
        )
        expect(insights.heatmaps?.getAndClearBuffer()).not.toEqual(undefined)
        expect(beforeSendMock.mock.calls).toEqual([])
    })

    it('should ignore an empty buffer', async () => {
        expect(beforeSendMock.mock.calls).toEqual([])

        expect(insights.heatmaps?.['buffer']).toEqual(undefined)

        jest.advanceTimersByTime(insights.heatmaps!.flushIntervalMilliseconds + 1)

        expect(beforeSendMock.mock.calls).toEqual([])
    })

    describe('onRemoteConfig', () => {
        it('does not overwrite persistence when called with empty config', () => {
            // Set up existing persisted value
            insights.persistence!.register({ [HEATMAPS_ENABLED_SERVER_SIDE]: true })
            const heatmaps = new Heatmaps(insights)

            // Call with empty config (simulating config fetch failure)
            heatmaps.onRemoteConfig({} as FlagsResponse)

            // Should NOT have overwritten the existing value
            expect(insights.persistence!.props[HEATMAPS_ENABLED_SERVER_SIDE]).toBe(true)
        })

        it('updates persistence when heatmaps key is present', () => {
            insights.persistence!.register({ [HEATMAPS_ENABLED_SERVER_SIDE]: true })
            const heatmaps = new Heatmaps(insights)

            heatmaps.onRemoteConfig({ heatmaps: false } as FlagsResponse)

            expect(insights.persistence!.props[HEATMAPS_ENABLED_SERVER_SIDE]).toBe(false)
        })
    })

    describe('isEnabled()', () => {
        it.each([
            [undefined, false],
            [null, false],
            [true, true],
            [false, false],
        ])('when stored remote config is %p - heatmaps enabled should be %p', (stored, expected) => {
            insights.persistence!.register({ [HEATMAPS_ENABLED_SERVER_SIDE]: stored })
            insights.config.enable_heatmaps = undefined
            insights.config.capture_heatmaps = undefined
            const heatmaps = new Heatmaps(insights)
            expect(heatmaps.isEnabled).toBe(expected)
        })

        it.each([
            [undefined, false],
            [null, false],
            [true, true],
            [false, false],
        ])('when local deprecated config is %p - heatmaps enabled should be %p', (deprecatedConfig, expected) => {
            insights.persistence!.register({ [HEATMAPS_ENABLED_SERVER_SIDE]: undefined })
            insights.config.enable_heatmaps = deprecatedConfig
            insights.config.capture_heatmaps = undefined
            const heatmaps = new Heatmaps(insights)
            expect(heatmaps.isEnabled).toBe(expected)
        })

        it.each([
            [undefined, false],
            [null, false],
            [true, true],
            [false, false],
        ])('when local current config is %p - heatmaps enabled should be %p', (localConfig, expected) => {
            insights.persistence!.register({ [HEATMAPS_ENABLED_SERVER_SIDE]: undefined })
            insights.config.enable_heatmaps = localConfig
            insights.config.capture_heatmaps = undefined
            const heatmaps = new Heatmaps(insights)
            expect(heatmaps.isEnabled).toBe(expected)
        })

        it.each([
            // deprecated client side not defined
            [undefined, undefined, false, false],
            [undefined, undefined, true, true],
            [undefined, true, false, true],
            [undefined, false, false, false],
            // null config values should fall through like undefined
            [null, undefined, false, false],
            [null, undefined, true, true],
            [undefined, null, false, false],
            [undefined, null, true, true],
            [null, null, false, false],
            [null, null, true, true],
            // deprecated client false
            [false, undefined, false, false],
            [false, undefined, true, false],
            [false, false, false, false],
            [false, false, true, false],
            [false, true, false, true],
            [false, true, true, true],

            // deprecated client true
            [true, undefined, false, true],
            [true, undefined, true, true],
            // current config overrides deprecated
            [true, false, false, false],
            [true, true, true, true],
        ])(
            'when deprecated client side config is %p, current client side config is %p, and remote opt in is %p - heatmaps enabled should be %p',
            (deprecatedclientSideOptIn, clientSideOptIn, serverSideOptIn, expected) => {
                insights.config.enable_heatmaps = deprecatedclientSideOptIn
                insights.config.capture_heatmaps = clientSideOptIn
                insights.heatmaps!.onRemoteConfig({
                    heatmaps: serverSideOptIn,
                } as FlagsResponse)
                expect(insights.heatmaps!.isEnabled).toBe(expected)
            }
        )
    })

    it('starts dead clicks autocapture with the correct config', () => {
        const heatmapsDeadClicksInstance = insights.heatmaps['_deadClicksCapture']
        expect(heatmapsDeadClicksInstance.isEnabled(heatmapsDeadClicksInstance)).toBe(true)
        // this is a little nasty but the binding to this makes the function not directly comparable
        expect(JSON.stringify(heatmapsDeadClicksInstance.onCapture)).toEqual(
            JSON.stringify(insights.heatmaps['_onDeadClick'].bind(insights.heatmaps))
        )
    })

    describe.each([
        [false, undefined, 'http://localhost/?gclid=12345&other=true'],
        [true, undefined, 'http://localhost/?gclid=<masked>&other=true'],
        [true, ['other'], 'http://localhost/?gclid=<masked>&other=<masked>'],
    ])(
        'the behaviour when mask_personal_data_properties is %s and custom_personal_data_properties is %s',
        (
            maskPersonalDataProperties: boolean,
            customPersonalDataProperties: undefined | string[],
            maskedUrl: string
        ) => {
            beforeEach(async () => {
                beforeSendMock = beforeSendMock.mockClear()

                const insightsWithMasking = await createInsightsInstance(uuidv7(), {
                    before_send: beforeSendMock,
                    mask_personal_data_properties: maskPersonalDataProperties,
                    custom_personal_data_properties: customPersonalDataProperties,
                })

                Object.defineProperty(window, 'location', {
                    value: {
                        href: 'http://localhost/?gclid=12345&other=true',
                    },
                    writable: true,
                })

                insightsWithMasking.config.capture_heatmaps = true
                insightsWithMasking.heatmaps!.startIfEnabled()
                insightsWithMasking.heatmaps?.['_onClick']?.(createMockMouseEvent())

                jest.advanceTimersByTime(insightsWithMasking.heatmaps!.flushIntervalMilliseconds + 1)
            })

            it('masks properties accordingly', async () => {
                const heatmapData = beforeSendMock.mock.lastCall[0].properties.$heatmap_data
                expect(heatmapData).toMatchObject({ [maskedUrl]: {} })
            })
        }
    )
})
