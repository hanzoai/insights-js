import { mockLogger } from './helpers/mock-logger'

import * as globals from '../utils/globals'
import { document, window } from '../utils/globals'
import { uuidv7 } from '../uuidv7'
import { ENABLE_PERSON_PROCESSING, USER_STATE } from '../constants'
import { createInsightsInstance, defaultInsights } from './helpers/insights-instance'
import { InsightsConfig, RemoteConfig } from '../types'
import { Insights } from '../insights-core'
import { InsightsPersistence } from '../insights-persistence'
import { SessionIdManager } from '../sessionid'
import { RequestQueue } from '../request-queue'
import { SessionRecording } from '../extensions/replay/session-recording'
import { SessionPropsManager } from '../session-props'

let mockGetProperties: jest.Mock

jest.mock('../utils/event-utils', () => {
    const originalEventUtils = jest.requireActual('../utils/event-utils')
    mockGetProperties = jest.fn().mockImplementation((...args) => originalEventUtils.getEventProperties(...args))
    return {
        ...originalEventUtils,
        getEventProperties: mockGetProperties,
    }
})

describe('insights core', () => {
    const baseUTCDateTime = new Date(Date.UTC(2020, 0, 1, 0, 0, 0))
    const eventName = '$event'

    const defaultConfig = {}

    const defaultOverrides = {
        _send_request: jest.fn(),
    }

    const insightsWith = (config: Partial<InsightsConfig>, overrides?: Partial<Insights>): Insights => {
        // NOTE: Temporary change whilst testing remote config
        const token = config.token || 'testtoken'
        globals.assignableWindow._INSIGHTS_REMOTE_CONFIG = {
            [token]: {
                config: {},
                siteApps: [],
            },
        } as any
        const insights = defaultInsights().init(token, config, uuidv7())
        return Object.assign(insights, overrides || {})
    }

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(baseUTCDateTime)
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    describe('capture()', () => {
        it('adds a UUID to each message', () => {
            const captureData = insightsWith(defaultConfig, defaultOverrides).capture(eventName, {}, {})
            expect(captureData).toHaveProperty('uuid')
        })

        it('adds system time to events', () => {
            const captureData = insightsWith(defaultConfig, defaultOverrides).capture(eventName, {}, {})

            expect(captureData).toHaveProperty('timestamp')
            // timer is fixed at 2020-01-01
            expect(captureData.timestamp).toEqual(baseUTCDateTime)
        })

        it('captures when time is overriden by caller', () => {
            const captureData = insightsWith(defaultConfig, defaultOverrides).capture(
                eventName,
                {},
                { timestamp: new Date(2020, 0, 2, 12, 34) }
            )
            expect(captureData).toHaveProperty('timestamp')
            expect(captureData.timestamp).toEqual(new Date(2020, 0, 2, 12, 34))
            expect(captureData.properties['$event_time_override_provided']).toEqual(true)
            expect(captureData.properties['$event_time_override_system_time']).toEqual(baseUTCDateTime)
        })

        it('handles recursive objects', () => {
            const props: Record<string, any> = {}
            props.recurse = props

            expect(() =>
                insightsWith(defaultConfig, defaultOverrides).capture(eventName, props, {
                    timestamp: new Date(2020, 0, 2, 12, 34),
                })
            ).not.toThrow()
        })

        it('calls callbacks added via _addCaptureHook', () => {
            const hook = jest.fn()
            const insights = insightsWith(defaultConfig, defaultOverrides)
            insights._addCaptureHook(hook)

            insights.capture(eventName, {}, {})
            expect(hook).toHaveBeenCalledWith(
                '$event',
                expect.objectContaining({
                    event: '$event',
                })
            )
        })

        it('calls update_campaign_params and update_referrer_info on sessionPersistence', () => {
            const insights = insightsWith(
                {
                    property_denylist: [],
                    property_blacklist: [],
                    store_google: true,
                    save_referrer: true,
                },
                {
                    ...defaultOverrides,
                    sessionPersistence: {
                        update_search_keyword: jest.fn(),
                        update_campaign_params: jest.fn(),
                        update_referrer_info: jest.fn(),
                        update_config: jest.fn(),
                        properties: jest.fn(),
                        get_property: () => 'anonymous',
                    } as unknown as InsightsPersistence,
                }
            )

            insights.capture(eventName, {}, {})

            expect(insights.sessionPersistence.update_campaign_params).toHaveBeenCalled()
            expect(insights.sessionPersistence.update_referrer_info).toHaveBeenCalled()
        })

        it('errors with undefined event name', () => {
            const hook = jest.fn()

            const insights = insightsWith(defaultConfig, defaultOverrides)
            insights._addCaptureHook(hook)

            expect(() => insights.capture(undefined)).not.toThrow()
            expect(hook).not.toHaveBeenCalled()
            expect(mockLogger.error).toHaveBeenCalledWith('No event name provided to insights.capture')
        })

        it('errors with object event name', () => {
            const hook = jest.fn()

            const insights = insightsWith(defaultConfig, defaultOverrides)
            insights._addCaptureHook(hook)

            // @ts-expect-error - testing invalid input
            expect(() => insights.capture({ event: 'object as name' })).not.toThrow()
            expect(hook).not.toHaveBeenCalled()
            expect(mockLogger.error).toHaveBeenCalledWith('No event name provided to insights.capture')
        })

        it('respects opt_out_useragent_filter (default: false)', () => {
            const originalNavigator = globals.navigator
            ;(globals as any).navigator = {
                ...globals.navigator,
                userAgent:
                    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36',
            }
            const hook = jest.fn()
            const insights = insightsWith(defaultConfig, defaultOverrides)
            insights._addCaptureHook(hook)

            insights.capture(eventName, {}, {})
            expect(hook).not.toHaveBeenCalledWith('$event')
            ;(globals as any)['navigator'] = originalNavigator
        })

        it('respects opt_out_useragent_filter', () => {
            const originalNavigator = globals.navigator
            ;(globals as any).navigator = {
                ...globals.navigator,
                userAgent:
                    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36',
            }

            const hook = jest.fn().mockImplementation((event) => event)
            const insights = insightsWith(
                {
                    opt_out_useragent_filter: true,
                    property_denylist: [],
                    property_blacklist: [],
                },
                defaultOverrides
            )
            insights._addCaptureHook(hook)

            const event = insights.capture(eventName, {}, {})

            expect(hook).toHaveBeenCalledWith(
                '$event',
                expect.objectContaining({
                    event: '$event',
                })
            )
            expect(event.properties['$browser_type']).toEqual('bot')
            ;(globals as any)['navigator'] = originalNavigator
        })

        it('truncates long properties', () => {
            const insights = insightsWith(
                {
                    properties_string_max_length: 1000,
                    property_denylist: [],
                    property_blacklist: [],
                },
                defaultOverrides
            )

            const event = insights.capture(
                eventName,
                {
                    key: 'value'.repeat(10000),
                },
                {}
            )

            expect(event.properties.key.length).toBe(1000)
        })

        it('keeps long properties if undefined', () => {
            const insights = insightsWith(
                {
                    properties_string_max_length: undefined,
                    property_denylist: [],
                    property_blacklist: [],
                },
                defaultOverrides
            )

            const event = insights.capture(
                eventName,
                {
                    key: 'value'.repeat(10000),
                },
                {}
            )

            expect(event.properties.key.length).toBe(50000)
        })

        it('passes through $set and $set_once into the request, if the event is an $identify event', () => {
            // NOTE: this is slightly unusual to test capture for this specific case
            // of being called with $identify as the event name. It might be that we
            // decide that this shouldn't be a special case of capture in this case,
            // but I'll add the case to capture current functionality.
            //
            // We check that if identify is called with user $set and $set_once
            // properties, we also want to ensure capture does the expected thing
            // with them.

            const insights = insightsWith(defaultConfig, defaultOverrides)

            const captureResult = insights.capture(
                '$identify',
                { distinct_id: 'some-distinct-id' },
                { $set: { email: 'john@example.com' }, $set_once: { howOftenAmISet: 'once!' } }
            )

            // We assume that the returned result is the object we would send to the
            // server.
            expect(captureResult).toEqual(
                expect.objectContaining({
                    $set: { email: 'john@example.com' },
                    $set_once: expect.objectContaining({ howOftenAmISet: 'once!' }),
                })
            )
        })

        it('updates persisted person properties for feature flags if $set is present', () => {
            const insights = insightsWith(
                {
                    property_denylist: [],
                    property_blacklist: [],
                },
                defaultOverrides
            )

            insights.capture(eventName, {
                $set: { foo: 'bar' },
            })
            expect(insights.persistence.props.$stored_person_properties).toMatchObject({ foo: 'bar' })
        })

        it('correctly handles the "length" property', () => {
            const insights = insightsWith(defaultConfig, defaultOverrides)
            const captureResult = insights.capture('event-name', { foo: 'bar', length: 0 })
            expect(captureResult.properties).toEqual(expect.objectContaining({ foo: 'bar', length: 0 }))
        })

        it('sends payloads to /e/ by default', () => {
            const insights = insightsWith({ ...defaultConfig, request_batching: false }, defaultOverrides)

            insights.capture('event-name', { foo: 'bar', length: 0 })

            expect(insights._send_request).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://us.i.insights.com/e/',
                })
            )
        })

        it('sends payloads to alternative endpoint if given', () => {
            const insights = insightsWith({ ...defaultConfig, request_batching: false }, defaultOverrides)
            insights._onRemoteConfig({ analytics: { endpoint: '/i/v0/e/' } } as RemoteConfig)

            insights.capture('event-name', { foo: 'bar', length: 0 })

            expect(insights._send_request).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://us.i.insights.com/i/v0/e/',
                })
            )
        })

        it('sends payloads to overriden endpoint if given', () => {
            const insights = insightsWith({ ...defaultConfig, request_batching: false }, defaultOverrides)

            insights.capture('event-name', { foo: 'bar', length: 0 }, { _url: 'https://app.insights.com/s/' })

            expect(insights._send_request).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://app.insights.com/s/',
                })
            )
        })

        it('sends payloads to overriden _url, even if alternative endpoint is set', () => {
            const insights = insightsWith({ ...defaultConfig, request_batching: false }, defaultOverrides)
            insights._onRemoteConfig({ analytics: { endpoint: '/i/v0/e/' } } as RemoteConfig)

            insights.capture('event-name', { foo: 'bar', length: 0 }, { _url: 'https://app.insights.com/s/' })

            expect(insights._send_request).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://app.insights.com/s/',
                })
            )
        })

        it('does not allow you to set complex current url', () => {
            const insights = insightsWith(defaultConfig, defaultOverrides)
            const captureResult = insights.capture('event-name', { $current_url: new URL('https://app.insights.com/s/') })

            expect(captureResult.properties.$current_url).toEqual('http://localhost/')
        })
    })

    describe('_afterFlagsResponse', () => {
        it('enables compression from flags response', () => {
            const insights = insightsWith({})

            insights._onRemoteConfig({ supportedCompression: ['gzip-js', 'base64'] } as RemoteConfig)

            expect(insights.compression).toEqual('gzip-js')
        })
        it('ignores legacy field defaultIdentifiedOnly from flags response', () => {
            const insights = insightsWith({})

            insights._onRemoteConfig({ defaultIdentifiedOnly: true } as RemoteConfig)
            expect(insights.config.person_profiles).toEqual('identified_only')

            insights._onRemoteConfig({ defaultIdentifiedOnly: false } as RemoteConfig)
            expect(insights.config.person_profiles).toEqual('identified_only')

            insights._onRemoteConfig({} as RemoteConfig)
            expect(insights.config.person_profiles).toEqual('identified_only')
        })
        it('defaultIdentifiedOnly does not override person_profiles if already set', () => {
            const insights = insightsWith({ person_profiles: 'always' })
            insights._onRemoteConfig({ defaultIdentifiedOnly: true } as RemoteConfig)
            expect(insights.config.person_profiles).toEqual('always')
        })

        it('enables compression from flags response when only one received', () => {
            const insights = insightsWith({})

            insights._onRemoteConfig({ supportedCompression: ['base64'] } as RemoteConfig)

            expect(insights.compression).toEqual('base64')
        })

        it('does not enable compression from flags response if compression is disabled', () => {
            const insights = insightsWith({ disable_compression: true, persistence: 'memory' })

            insights._onRemoteConfig({ supportedCompression: ['gzip-js', 'base64'] } as RemoteConfig)

            expect(insights.compression).toEqual(undefined)
        })

        it('defaults to /e if no endpoint is given', () => {
            const insights = insightsWith({})

            insights._onRemoteConfig({} as RemoteConfig)

            expect(insights.analyticsDefaultEndpoint).toEqual('/e/')
        })

        it('uses the specified analytics endpoint if given', () => {
            const insights = insightsWith({})

            insights._onRemoteConfig({ analytics: { endpoint: '/i/v0/e/' } } as RemoteConfig)

            expect(insights.analyticsDefaultEndpoint).toEqual('/i/v0/e/')
        })
    })

    describe('_calculate_event_properties()', () => {
        let insights: Insights
        const uuid = 'uuid'

        const overrides: Partial<Insights> = {
            persistence: {
                properties: () => ({ distinct_id: 'abc', persistent: 'prop', $is_identified: false }),
                remove_event_timer: jest.fn(),
                get_property: () => 'anonymous',
                props: {},
                register: jest.fn(),
            } as unknown as InsightsPersistence,
            sessionPersistence: {
                properties: () => ({ distinct_id: 'abc', persistent: 'prop' }),
                get_property: () => 'anonymous',
            } as unknown as InsightsPersistence,
            sessionManager: {
                checkAndGetSessionAndWindowId: jest.fn().mockReturnValue({
                    windowId: 'windowId',
                    sessionId: 'sessionId',
                }),
            } as unknown as SessionIdManager,
            sessionPropsManager: {
                getSessionProps: jest.fn().mockReturnValue({
                    $session_entry_referring_domain: 'https://referrer.example.com',
                }),
            } as unknown as SessionPropsManager,
        }

        beforeEach(() => {
            mockGetProperties.mockReturnValue({ $lib: 'web' })

            insights = insightsWith(
                {
                    api_host: 'https://app.insights.com',
                    token: 'testtoken',
                    property_denylist: [],
                    property_blacklist: [],
                    sanitize_properties: undefined,
                },
                overrides
            )
        })

        it('returns calculated properties', () => {
            expect(insights.calculateEventProperties('custom_event', { event: 'prop' }, new Date(), uuid)).toEqual({
                token: 'testtoken',
                event: 'prop',
                $lib: 'web',
                distinct_id: 'abc',
                persistent: 'prop',
                $window_id: 'windowId',
                $session_id: 'sessionId',
                $session_entry_referring_domain: 'https://referrer.example.com',
                $is_identified: false,
                $process_person_profile: false,
                $recording_status: 'pending_config',
                $sdk_debug_retry_queue_size: 0,
                $config_defaults: 'unset',
            })
        })

        it('sets $lib_custom_api_host if api_host is not the default', () => {
            insights = insightsWith(
                {
                    api_host: 'https://custom.insights.com',
                },
                overrides
            )

            expect(insights.calculateEventProperties('custom_event', { event: 'prop' }, new Date(), uuid)).toEqual({
                token: 'testtoken',
                event: 'prop',
                $lib: 'web',
                distinct_id: 'abc',
                persistent: 'prop',
                $window_id: 'windowId',
                $session_id: 'sessionId',
                $session_entry_referring_domain: 'https://referrer.example.com',
                $lib_custom_api_host: 'https://custom.insights.com',
                $is_identified: false,
                $process_person_profile: false,
                $recording_status: 'pending_config',
                $sdk_debug_retry_queue_size: 0,
                $config_defaults: 'unset',
            })
        })

        it("can't deny or blacklist $process_person_profile", () => {
            insights = insightsWith(
                {
                    api_host: 'https://custom.insights.com',
                    property_denylist: ['$process_person_profile'],
                    property_blacklist: ['$process_person_profile'],
                },
                overrides
            )

            expect(
                insights.calculateEventProperties('custom_event', { event: 'prop' }, new Date(), uuid)[
                    '$process_person_profile'
                ]
            ).toEqual(false)
        })

        it('only adds token and distinct_id if event_name is $snapshot', () => {
            insights = insightsWith(
                {
                    api_host: 'https://custom.insights.com',
                },
                overrides
            )

            expect(insights.calculateEventProperties('$snapshot', { event: 'prop' }, new Date(), uuid)).toEqual({
                token: 'testtoken',
                event: 'prop',
                distinct_id: 'abc',
                $config_defaults: 'unset',
            })
            expect(insights.sessionManager.checkAndGetSessionAndWindowId).not.toHaveBeenCalled()
        })

        it('calls sanitize_properties', () => {
            insights = insightsWith(
                {
                    api_host: 'https://custom.insights.com',
                    sanitize_properties: (props, event_name) => ({ token: props.token, event_name }),
                },
                overrides
            )

            expect(insights.calculateEventProperties('custom_event', { event: 'prop' }, new Date(), uuid)).toEqual({
                event_name: 'custom_event',
                token: 'testtoken',
                $process_person_profile: false,
            })
        })

        it('calls sanitize_properties for $set_once', () => {
            insights = insightsWith(
                {
                    api_host: 'https://custom.insights.com',
                    sanitize_properties: (props, event_name) => ({ token: props.token, event_name, ...props }),
                },
                overrides
            )

            insights.persistence.get_initial_props = () => ({ initial: 'prop' })
            insights.sessionPropsManager.getSetOnceProps = () => ({ session: 'prop' })
            insights.persistence.props[ENABLE_PERSON_PROCESSING] = true // person processing is needed for $set_once
            expect(insights._calculate_set_once_properties({ key: 'prop' })).toEqual({
                event_name: '$set_once',
                token: undefined,
                initial: 'prop',
                session: 'prop',
                key: 'prop',
            })
        })

        it('saves $snapshot data and token for $snapshot events', () => {
            insights = insightsWith({}, overrides)

            expect(insights.calculateEventProperties('$snapshot', { $snapshot_data: {} }, new Date(), uuid)).toEqual({
                token: 'testtoken',
                $snapshot_data: {},
                distinct_id: 'abc',
                $config_defaults: 'unset',
            })
        })

        it("doesn't modify properties passed into it", () => {
            const properties = { prop1: 'val1', prop2: 'val2' }

            insights.calculateEventProperties('custom_event', properties, new Date(), uuid)

            expect(Object.keys(properties)).toEqual(['prop1', 'prop2'])
        })

        it('adds page title to $pageview', () => {
            document!.title = 'test'

            expect(insights.calculateEventProperties('$pageview', {}, new Date(), uuid)).toEqual(
                expect.objectContaining({ title: 'test' })
            )
        })

        it('includes pageview id from previous pageview', () => {
            const pageview1Properties = insights.calculateEventProperties('$pageview', {}, new Date(), 'pageview-id-1')
            expect(pageview1Properties.$pageview_id).toEqual('pageview-id-1')

            const event1Properties = insights.calculateEventProperties('custom event', {}, new Date(), 'event-id-1')
            expect(event1Properties.$pageview_id).toEqual('pageview-id-1')

            const pageview2Properties = insights.calculateEventProperties('$pageview', {}, new Date(), 'pageview-id-2')
            expect(pageview2Properties.$pageview_id).toEqual('pageview-id-2')
            expect(pageview2Properties.$prev_pageview_id).toEqual('pageview-id-1')

            const event2Properties = insights.calculateEventProperties('custom event', {}, new Date(), 'event-id-2')
            expect(event2Properties.$pageview_id).toEqual('pageview-id-2')

            const pageleaveProperties = insights.calculateEventProperties('$pageleave', {}, new Date(), 'pageleave-id')
            expect(pageleaveProperties.$pageview_id).toEqual('pageview-id-2')
            expect(pageleaveProperties.$prev_pageview_id).toEqual('pageview-id-2')
        })
    })

    describe('_handle_unload()', () => {
        it('captures $pageleave', () => {
            const insights = insightsWith(
                {
                    capture_pageview: true,
                    capture_pageleave: 'if_capture_pageview',
                    request_batching: true,
                },
                { capture: jest.fn() }
            )

            insights._handle_unload()

            expect(insights.capture).toHaveBeenCalledWith('$pageleave')
        })

        it('captures $pageleave when capture_pageview is set to history_change', () => {
            const insights = insightsWith(
                {
                    capture_pageview: 'history_change',
                    capture_pageleave: 'if_capture_pageview',
                    request_batching: true,
                },
                { capture: jest.fn() }
            )

            insights._handle_unload()

            expect(insights.capture).toHaveBeenCalledWith('$pageleave')
        })

        it('does not capture $pageleave when capture_pageview=false and capture_pageleave=if_capture_pageview', () => {
            const insights = insightsWith(
                {
                    capture_pageview: false,
                    capture_pageleave: 'if_capture_pageview',
                    request_batching: true,
                },
                { capture: jest.fn() }
            )

            insights._handle_unload()

            expect(insights.capture).not.toHaveBeenCalled()
        })

        it('does capture $pageleave when capture_pageview=false and capture_pageleave=true', () => {
            const insights = insightsWith(
                {
                    capture_pageview: false,
                    capture_pageleave: true,
                    request_batching: true,
                },
                { capture: jest.fn() }
            )

            insights._handle_unload()

            expect(insights.capture).toHaveBeenCalledWith('$pageleave')
        })

        it('calls requestQueue unload', () => {
            const insights = insightsWith(
                {
                    capture_pageview: true,
                    capture_pageleave: 'if_capture_pageview',
                    request_batching: true,
                },
                { _requestQueue: { enqueue: jest.fn(), unload: jest.fn() } as unknown as RequestQueue }
            )

            insights._handle_unload()

            expect(insights._requestQueue.unload).toHaveBeenCalledTimes(1)
        })

        describe('without batching', () => {
            it('captures $pageleave', () => {
                const insights = insightsWith(
                    {
                        capture_pageview: true,
                        capture_pageleave: 'if_capture_pageview',
                        request_batching: false,
                    },
                    { capture: jest.fn() }
                )
                insights._handle_unload()

                expect(insights.capture).toHaveBeenCalledWith('$pageleave', null, { transport: 'sendBeacon' })
            })

            it('captures $pageleave when capture_pageview is set to history_change', () => {
                const insights = insightsWith(
                    {
                        capture_pageview: 'history_change',
                        capture_pageleave: 'if_capture_pageview',
                        request_batching: false,
                    },
                    { capture: jest.fn() }
                )
                insights._handle_unload()

                expect(insights.capture).toHaveBeenCalledWith('$pageleave', null, { transport: 'sendBeacon' })
            })

            it('does not capture $pageleave when capture_pageview=false', () => {
                const insights = insightsWith(
                    {
                        capture_pageview: false,
                        capture_pageleave: 'if_capture_pageview',
                        request_batching: false,
                    },
                    { capture: jest.fn() }
                )
                insights._handle_unload()

                expect(insights.capture).not.toHaveBeenCalled()
            })
        })
    })

    describe('bootstrapping feature flags', () => {
        it('sets the right distinctID', () => {
            const insights = insightsWith(
                {
                    bootstrap: {
                        distinctID: 'abcd',
                    },
                },
                { capture: jest.fn() }
            )

            expect(insights.get_distinct_id()).toBe('abcd')
            expect(insights.get_property('$device_id')).toBe('abcd')
            expect(insights.persistence.get_property(USER_STATE)).toBe('anonymous')

            insights.identify('efgh')

            expect(insights.capture).toHaveBeenCalledWith(
                '$identify',
                {
                    distinct_id: 'efgh',
                    $anon_distinct_id: 'abcd',
                },
                { $set: {}, $set_once: {} }
            )
        })

        it('treats identified distinctIDs appropriately', () => {
            const insights = insightsWith(
                {
                    bootstrap: {
                        distinctID: 'abcd',
                        isIdentifiedID: true,
                    },
                    get_device_id: () => 'og-device-id',
                },
                { capture: jest.fn() }
            )

            expect(insights.get_distinct_id()).toBe('abcd')
            expect(insights.get_property('$device_id')).toBe('og-device-id')
            expect(insights.persistence.get_property(USER_STATE)).toBe('identified')

            insights.identify('efgh')
            expect(insights.capture).not.toHaveBeenCalled()
        })

        it('sets the right feature flags', () => {
            const insights = insightsWith({
                bootstrap: {
                    featureFlags: {
                        multivariant: 'variant-1',
                        enabled: true,
                        disabled: false,
                        // TODO why are we testing that undefined is passed through?
                        undef: undefined as unknown as string | boolean,
                    },
                },
            })

            expect(insights.get_distinct_id()).not.toBe('abcd')
            expect(insights.get_distinct_id()).not.toEqual(undefined)
            expect(insights.getFeatureFlag('multivariant')).toBe('variant-1')
            expect(insights.getFeatureFlag('disabled')).toBe(undefined)
            expect(insights.getFeatureFlag('undef')).toBe(undefined)
            expect(insights.featureFlags.getFlagVariants()).toEqual({ multivariant: 'variant-1', enabled: true })
        })

        it('sets the right feature flag payloads', () => {
            const insights = insightsWith({
                bootstrap: {
                    featureFlags: {
                        multivariant: 'variant-1',
                        enabled: true,
                        jsonString: true,
                        disabled: false,
                        // TODO why are we testing that undefined is passed through?
                        undef: undefined as unknown as string | boolean,
                    },
                    featureFlagPayloads: {
                        multivariant: 'some-payload',
                        enabled: {
                            another: 'value',
                        },
                        disabled: 'should not show',
                        undef: 200,
                        jsonString: '{"a":"payload"}',
                    },
                },
            })

            expect(insights.getFeatureFlagPayload('multivariant')).toBe('some-payload')
            expect(insights.getFeatureFlagPayload('enabled')).toEqual({ another: 'value' })
            expect(insights.getFeatureFlagPayload('jsonString')).toEqual({ a: 'payload' })
            expect(insights.getFeatureFlagPayload('disabled')).toBe(undefined)
            expect(insights.getFeatureFlagPayload('undef')).toBe(undefined)
        })

        it('does nothing when empty', () => {
            const insights = insightsWith({
                bootstrap: {},
                persistence: 'memory',
            })

            expect(insights.get_distinct_id()).not.toBe('abcd')
            expect(insights.get_distinct_id()).not.toEqual(undefined)
            expect(insights.getFeatureFlag('multivariant')).toBe(undefined)
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('getFeatureFlag for key "multivariant" failed')
            )
            expect(insights.getFeatureFlag('disabled')).toBe(undefined)
            expect(insights.getFeatureFlag('undef')).toBe(undefined)
            expect(insights.featureFlags.getFlagVariants()).toEqual({})
        })

        it('onFeatureFlags should be called immediately if feature flags are bootstrapped', () => {
            let called = false
            const insights = insightsWith({
                bootstrap: {
                    featureFlags: { multivariant: 'variant-1' },
                },
            })

            insights.featureFlags.onFeatureFlags(() => (called = true))
            expect(called).toEqual(true)
        })

        it('onFeatureFlags should not be called immediately if feature flags bootstrap is empty', () => {
            let called = false

            const insights = insightsWith({
                bootstrap: {
                    featureFlags: {},
                },
            })

            insights.featureFlags.onFeatureFlags(() => (called = true))
            expect(called).toEqual(false)
        })

        it('onFeatureFlags should not be called immediately if feature flags bootstrap is undefined', () => {
            let called = false

            const insights = insightsWith({
                bootstrap: {
                    featureFlags: undefined,
                },
            })

            insights.featureFlags.onFeatureFlags(() => (called = true))
            expect(called).toEqual(false)
        })
    })

    describe('init()', () => {
        jest.spyOn(window, 'window', 'get')

        beforeEach(() => {
            jest.spyOn(window.console, 'warn').mockImplementation()
            jest.spyOn(window.console, 'error').mockImplementation()
        })

        it('can set an xhr error handler', () => {
            const fakeOnXHRError = jest.fn()
            const insights = insightsWith({
                on_xhr_error: fakeOnXHRError,
            })
            expect(insights.config.on_xhr_error).toBe(fakeOnXHRError)
        })

        it('should not fail with recursive object in config', () => {
            // this will happen if people are passing e.g. window.analytics
            const config: Record<string, any> = {
                debug: true,
            }
            config.recursive = config
            insightsWith(config as Partial<InsightsConfig>)
        })

        it.skip('does not load feature flags, session recording', () => {
            // TODO this didn't make a tonne of sense in the given form
            // it makes no sense now
            // of course mocks added _after_ init will not be called
            const insights = defaultInsights().init('testtoken', defaultConfig, uuidv7())!

            insights.sessionRecording = {
                afterFlagsResponse: jest.fn(),
                startIfEnabledOrStop: jest.fn(),
            } as unknown as SessionRecording
            insights.persistence = {
                register: jest.fn(),
                update_config: jest.fn(),
            } as unknown as InsightsPersistence

            // Feature flags
            expect(insights.persistence.register).not.toHaveBeenCalled() // FFs are saved this way

            // Session recording
            expect(insights.sessionRecording.onRemoteConfig).not.toHaveBeenCalled()
        })

        describe('device id behavior', () => {
            let uninitialisedInsights: Insights
            beforeEach(() => {
                uninitialisedInsights = defaultInsights()
            })

            it('sets a random UUID as distinct_id/$device_id if distinct_id is unset', () => {
                uninitialisedInsights.persistence = {
                    props: { distinct_id: undefined },
                } as unknown as InsightsPersistence
                const insights = uninitialisedInsights.init(
                    uuidv7(),
                    {
                        get_device_id: (uuid) => uuid,
                    },
                    uuidv7()
                )!

                expect(insights.persistence!.props).toMatchObject({
                    $device_id: expect.stringMatching(/^[0-9a-f-]+$/),
                    distinct_id: expect.stringMatching(/^[0-9a-f-]+$/),
                })

                expect(insights.persistence!.props.$device_id).toEqual(insights.persistence!.props.distinct_id)
            })

            it('does not set distinct_id/$device_id if distinct_id is unset', () => {
                uninitialisedInsights.persistence = {
                    props: { distinct_id: 'existing-id' },
                } as unknown as InsightsPersistence
                const insights = uninitialisedInsights.init(
                    uuidv7(),
                    {
                        get_device_id: (uuid) => uuid,
                    },
                    uuidv7()
                )!

                expect(insights.persistence!.props.distinct_id).not.toEqual('existing-id')
            })

            it('uses config.get_device_id for uuid generation if passed', () => {
                const insights = uninitialisedInsights.init(
                    uuidv7(),
                    {
                        get_device_id: (uuid) => 'custom-' + uuid.slice(0, 8),
                        persistence: 'memory',
                    },
                    uuidv7()
                )!

                expect(insights.persistence!.props).toMatchObject({
                    $device_id: expect.stringMatching(/^custom-[0-9a-f-]+$/),
                    distinct_id: expect.stringMatching(/^custom-[0-9a-f-]+$/),
                })
            })
        })
    })

    describe('skipped init()', () => {
        it('capture() does not throw', () => {
            expect(() => defaultInsights().capture('$pageview')).not.toThrow()

            expect(mockLogger.uninitializedWarning).toHaveBeenCalledWith('insights.capture')
        })
    })

    describe('group()', () => {
        let insights: Insights

        beforeEach(() => {
            insights = defaultInsights().init(
                'testtoken',
                {
                    persistence: 'memory',
                },
                uuidv7()
            )!
            insights.persistence!.clear()
            insights.reloadFeatureFlags = jest.fn()
            insights.capture = jest.fn()
        })

        it('records info on groups', () => {
            insights.group('organization', 'org::5')
            expect(insights.getGroups()).toEqual({ organization: 'org::5' })

            insights.group('organization', 'org::6')
            expect(insights.getGroups()).toEqual({ organization: 'org::6' })

            insights.group('instance', 'app.insights.com')
            expect(insights.getGroups()).toEqual({ organization: 'org::6', instance: 'app.insights.com' })
        })

        it('records info on groupProperties for groups', () => {
            insights.group('organization', 'org::5', { name: 'Insights' })
            expect(insights.getGroups()).toEqual({ organization: 'org::5' })

            expect(insights.persistence!.props['$stored_group_properties']).toEqual({
                organization: { name: 'Insights' },
            })

            insights.group('organization', 'org::6')
            expect(insights.getGroups()).toEqual({ organization: 'org::6' })
            expect(insights.persistence!.props['$stored_group_properties']).toEqual({ organization: {} })

            insights.group('instance', 'app.insights.com')
            expect(insights.getGroups()).toEqual({ organization: 'org::6', instance: 'app.insights.com' })
            expect(insights.persistence!.props['$stored_group_properties']).toEqual({ organization: {}, instance: {} })

            // now add properties to the group
            insights.group('organization', 'org::7', { name: 'Insights2' })
            expect(insights.getGroups()).toEqual({ organization: 'org::7', instance: 'app.insights.com' })
            expect(insights.persistence!.props['$stored_group_properties']).toEqual({
                organization: { name: 'Insights2' },
                instance: {},
            })

            insights.group('instance', 'app.insights.com', { a: 'b' })
            expect(insights.getGroups()).toEqual({ organization: 'org::7', instance: 'app.insights.com' })
            expect(insights.persistence!.props['$stored_group_properties']).toEqual({
                organization: { name: 'Insights2' },
                instance: { a: 'b' },
            })

            insights.resetGroupPropertiesForFlags()
            expect(insights.persistence!.props['$stored_group_properties']).toEqual(undefined)
        })

        it('does not result in a capture call', () => {
            insights.group('organization', 'org::5')

            expect(insights.capture).not.toHaveBeenCalled()
        })

        it('results in a reloadFeatureFlags call if group changes', () => {
            insights.group('organization', 'org::5', { name: 'Insights' })
            insights.group('instance', 'app.insights.com')
            insights.group('organization', 'org::5')

            expect(insights.reloadFeatureFlags).toHaveBeenCalledTimes(2)
        })

        it('results in a reloadFeatureFlags call if group properties change', () => {
            insights.group('organization', 'org::5')
            insights.group('instance', 'app.insights.com')
            insights.group('organization', 'org::5', { name: 'Insights' })
            insights.group('instance', 'app.insights.com')

            expect(insights.reloadFeatureFlags).toHaveBeenCalledTimes(3)
        })

        it('captures $groupidentify event', () => {
            insights.group('organization', 'org::5', { group: 'property', foo: 5 })

            expect(insights.capture).toHaveBeenCalledWith('$groupidentify', {
                $group_type: 'organization',
                $group_key: 'org::5',
                $group_set: {
                    group: 'property',
                    foo: 5,
                },
            })
        })

        describe('subsequent capture calls', () => {
            beforeEach(() => {
                insights = defaultInsights().init(
                    'testtoken',
                    {
                        persistence: 'memory',
                    },
                    uuidv7()
                )!
                insights.persistence!.clear()
                // mock this internal queue - not capture
                insights._requestQueue = {
                    enqueue: jest.fn(),
                } as unknown as RequestQueue
            })

            it('sends group information in event properties', () => {
                insights.group('organization', 'org::5')
                insights.group('instance', 'app.insights.com')

                insights.capture('some_event', { prop: 5 })

                expect(insights._requestQueue!.enqueue).toHaveBeenCalledTimes(1)

                const eventPayload = jest.mocked(insights._requestQueue!.enqueue).mock.calls[0][0]
                // need to help TS know event payload data is not an array
                // eslint-disable-next-line @hanzo/insights/no-direct-array-check
                if (Array.isArray(eventPayload.data!)) {
                    throw new Error('')
                }
                expect(eventPayload.data!.event).toEqual('some_event')
                expect(eventPayload.data!.properties.$groups).toEqual({
                    organization: 'org::5',
                    instance: 'app.insights.com',
                })
            })
        })

        describe('error handling', () => {
            it('handles blank keys being passed', () => {
                ;(window as any).console.error = jest.fn()
                ;(window as any).console.warn = jest.fn()

                insights.register = jest.fn()

                insights.group(null as unknown as string, 'foo')
                insights.group('organization', null as unknown as string)
                insights.group('organization', undefined as unknown as string)
                insights.group('organization', '')
                insights.group('', 'foo')

                expect(insights.register).not.toHaveBeenCalled()
            })
        })

        describe('reset group', () => {
            it('groups property is empty and reloads feature flags', () => {
                insights.group('organization', 'org::5')
                insights.group('instance', 'app.insights.com', { group: 'property', foo: 5 })

                expect(insights.persistence!.props['$groups']).toEqual({
                    organization: 'org::5',
                    instance: 'app.insights.com',
                })

                expect(insights.persistence!.props['$stored_group_properties']).toEqual({
                    organization: {},
                    instance: {
                        group: 'property',
                        foo: 5,
                    },
                })

                insights.resetGroups()

                expect(insights.persistence!.props['$groups']).toEqual({})
                expect(insights.persistence!.props['$stored_group_properties']).toEqual(undefined)

                expect(insights.reloadFeatureFlags).toHaveBeenCalledTimes(3)
            })
        })
    })

    describe('config migration', () => {
        it('uses advanced_disable_flags when set', () => {
            const insights = insightsWith({ advanced_disable_flags: true })
            expect(insights._shouldDisableFlags()).toBe(true)
        })

        it('falls back to advanced_disable_decide with deprecation warning', () => {
            const warnSpy = jest.spyOn(mockLogger, 'warn')
            const insights = insightsWith({ advanced_disable_decide: true })
            expect(insights._shouldDisableFlags()).toBe(true)
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining("Config field 'advanced_disable_decide' is deprecated")
            )
        })

        it('prioritizes advanced_disable_flags over advanced_disable_decide', () => {
            const warnSpy = jest.spyOn(mockLogger, 'warn')
            const insights = insightsWith({
                advanced_disable_flags: false,
                advanced_disable_decide: true,
            })
            expect(insights._shouldDisableFlags()).toBe(false)
            expect(warnSpy).not.toHaveBeenCalledWith(
                expect.stringContaining("Config field 'advanced_disable_decide' is deprecated")
            )
        })

        it('returns false when neither field is set', () => {
            const insights = insightsWith({})
            expect(insights._shouldDisableFlags()).toBe(false)
        })
    })

    describe('_loaded()', () => {
        it('calls loaded config option', () => {
            const insights = insightsWith({ loaded: jest.fn() })

            insights._loaded()

            expect(insights.config.loaded).toHaveBeenCalledWith(insights)
        })

        it('handles loaded config option throwing gracefully', () => {
            const insights = insightsWith({
                loaded: () => {
                    throw Error()
                },
            })

            insights._loaded()

            expect(mockLogger.critical).toHaveBeenCalledWith('`loaded` function failed', expect.anything())
        })

        describe('/flags', () => {
            beforeEach(() => {
                jest.useFakeTimers()
            })

            afterEach(() => {
                jest.useRealTimers()
            })

            it('is called by default', async () => {
                const sendRequestMock = jest.fn()
                await createInsightsInstance(uuidv7(), {
                    loaded: (ph) => {
                        ph._send_request = sendRequestMock
                    },
                })

                // Advance past the 5ms debounce timer from reloadFeatureFlags
                jest.advanceTimersByTime(10)

                expect(sendRequestMock.mock.calls[0][0]).toMatchObject({
                    url: 'http://localhost/flags/?v=2',
                })
            })

            it('does not call flags if disabled', async () => {
                const sendRequestMock = jest.fn()
                await createInsightsInstance(uuidv7(), {
                    advanced_disable_flags: true,
                    loaded: (ph) => {
                        ph._send_request = sendRequestMock
                    },
                })

                jest.advanceTimersByTime(10)
                expect(sendRequestMock).not.toHaveBeenCalled()
            })
        })
    })

    describe('capturing pageviews', () => {
        it('captures not capture pageview if disabled', async () => {
            jest.useFakeTimers()

            const instance = await createInsightsInstance(uuidv7(), {
                capture_pageview: false,
            })
            instance.capture = jest.fn()

            // TODO you shouldn't need to emit an event to get the pending timer to emit the pageview
            // but you do :shrug:
            instance.capture('not a pageview', {})

            jest.runOnlyPendingTimers()

            expect(instance.capture).not.toHaveBeenLastCalledWith(
                '$pageview',
                { title: 'test' },
                { send_instantly: true }
            )
        })

        it('captures pageview if enabled', async () => {
            jest.useFakeTimers()

            const instance = await createInsightsInstance(uuidv7(), {
                capture_pageview: true,
            })
            instance.capture = jest.fn()

            // TODO you shouldn't need to emit an event to get the pending timer to emit the pageview
            // but you do :shrug:
            instance.capture('not a pageview', {})

            jest.runOnlyPendingTimers()

            expect(instance.capture).toHaveBeenLastCalledWith('$pageview', { title: 'test' }, { send_instantly: true })
        })
    })

    describe('session_id', () => {
        let instance: Insights
        let token: string

        beforeEach(async () => {
            token = uuidv7()
            instance = await createInsightsInstance(token, {
                api_host: 'https://us.insights.com',
            })
            instance.sessionManager!.checkAndGetSessionAndWindowId = jest.fn().mockReturnValue({
                windowId: 'windowId',
                sessionId: 'sessionId',
                sessionStartTimestamp: new Date().getTime() - 30000,
            })
        })

        it('returns the session_id', () => {
            expect(instance.get_session_id()).toEqual('sessionId')
        })

        it('returns the replay URL', () => {
            expect(instance.get_session_replay_url()).toEqual(
                `https://us.insights.com/project/${token}/replay/sessionId`
            )
        })

        it('returns the replay URL including timestamp', () => {
            expect(instance.get_session_replay_url({ withTimestamp: true })).toEqual(
                `https://us.insights.com/project/${token}/replay/sessionId?t=20` // default lookback is 10 seconds
            )

            expect(instance.get_session_replay_url({ withTimestamp: true, timestampLookBack: 0 })).toEqual(
                `https://us.insights.com/project/${token}/replay/sessionId?t=30`
            )
        })
    })

    it('deprecated web performance observer still exposes _forceAllowLocalhost', async () => {
        const insights = await createInsightsInstance(uuidv7())
        expect(insights.webPerformance._forceAllowLocalhost).toBe(false)
        expect(() => insights.webPerformance._forceAllowLocalhost).not.toThrow()
    })
})
