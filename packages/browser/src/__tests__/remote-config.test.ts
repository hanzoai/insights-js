import { RemoteConfigLoader } from '../remote-config'
import { RequestRouter } from '../utils/request-router'
import { Insights } from '../insights-core'
import { InsightsConfig, RemoteConfig } from '../types'
import '../entrypoints/external-scripts-loader'
import { assignableWindow } from '../utils/globals'
import { createMockInsights } from './helpers/insights-instance'

describe('RemoteConfigLoader', () => {
    let insights: Insights

    beforeEach(() => {
        jest.useFakeTimers()

        const defaultConfig: Partial<InsightsConfig> = {
            token: 'testtoken',
            api_host: 'https://test.com',
            persistence: 'memory',
        }

        document.body.innerHTML = ''
        document.head.innerHTML = ''
        jest.spyOn(window.console, 'error').mockImplementation()

        insights = createMockInsights({
            config: { ...defaultConfig },
            _onRemoteConfig: jest.fn(),
            _send_request: jest.fn().mockImplementation(({ callback }) => callback?.({ config: {} })),
            _shouldDisableFlags: () =>
                insights.config.advanced_disable_flags || insights.config.advanced_disable_decide || false,
            featureFlags: {
                ensureFlagsLoaded: jest.fn(),
                reloadFeatureFlags: jest.fn(),
            },
            requestRouter: new RequestRouter(createMockInsights({ config: defaultConfig })),
        })
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    describe('remote config', () => {
        const config = { surveys: true } as RemoteConfig

        beforeEach(() => {
            assignableWindow._INSIGHTS_REMOTE_CONFIG = undefined
            assignableWindow.INSIGHTS_DEBUG = true

            assignableWindow.__InsightsExtensions__.loadExternalDependency = jest.fn(
                (_ph: Insights, _name: string, cb: (err?: any) => void) => {
                    assignableWindow._INSIGHTS_REMOTE_CONFIG = {}
                    assignableWindow._INSIGHTS_REMOTE_CONFIG[_ph.config.token] = {
                        config,
                        siteApps: [],
                    }
                    cb()
                }
            )

            insights._send_request = jest.fn().mockImplementation(({ callback }) => callback?.({ json: config }))
        })

        it('properly pulls from the window and uses it if set', () => {
            assignableWindow._INSIGHTS_REMOTE_CONFIG = {
                [insights.config.token]: {
                    config,
                    siteApps: [],
                },
            }
            new RemoteConfigLoader(insights).load()

            expect(assignableWindow.__InsightsExtensions__.loadExternalDependency).not.toHaveBeenCalled()
            expect(insights._send_request).not.toHaveBeenCalled()

            expect(insights._onRemoteConfig).toHaveBeenCalledWith(config)
        })

        it('loads the script if window config not set', () => {
            new RemoteConfigLoader(insights).load()

            expect(assignableWindow.__InsightsExtensions__.loadExternalDependency).toHaveBeenCalledWith(
                insights,
                'remote-config',
                expect.any(Function)
            )
            expect(insights._send_request).not.toHaveBeenCalled()
            expect(insights._onRemoteConfig).toHaveBeenCalledWith(config)
        })

        it('loads the json if window config not set and js failed', () => {
            assignableWindow.__InsightsExtensions__.loadExternalDependency = jest.fn(
                (_ph: Insights, _name: string, cb: (err?: any) => void) => {
                    cb()
                }
            )

            new RemoteConfigLoader(insights).load()

            expect(assignableWindow.__InsightsExtensions__.loadExternalDependency).toHaveBeenCalled()
            expect(insights._send_request).toHaveBeenCalledWith({
                method: 'GET',
                url: 'https://test.com/array/testtoken/config',
                callback: expect.any(Function),
            })
            expect(insights._onRemoteConfig).toHaveBeenCalledWith(config)
        })

        it.each([
            [true, true],
            [false, false],
            [undefined, true],
        ])('conditionally reloads feature flags - hasFlags: %s, shouldReload: %s', (hasFeatureFlags, shouldReload) => {
            assignableWindow._INSIGHTS_REMOTE_CONFIG = {
                [insights.config.token]: {
                    config: { ...config, hasFeatureFlags },
                    siteApps: [],
                },
            }

            new RemoteConfigLoader(insights).load()

            if (shouldReload) {
                expect(insights.featureFlags.ensureFlagsLoaded).toHaveBeenCalled()
            } else {
                expect(insights.featureFlags.ensureFlagsLoaded).not.toHaveBeenCalled()
            }
        })

        it('still initializes extensions and loads flags when config fetch fails', () => {
            assignableWindow.__InsightsExtensions__.loadExternalDependency = jest.fn(
                (_ph: Insights, _name: string, cb: (err?: any) => void) => {
                    cb()
                }
            )
            insights._send_request = jest.fn().mockImplementation(({ callback }) => callback?.({ json: undefined }))

            new RemoteConfigLoader(insights).load()

            // Should still call _onRemoteConfig with empty object so extensions start
            expect(insights._onRemoteConfig).toHaveBeenCalledWith({})
            // Should still attempt to load flags
            expect(insights.featureFlags.ensureFlagsLoaded).toHaveBeenCalled()
        })

        it('does not call ensureFlagsLoaded when advanced_disable_feature_flags_on_first_load is true', () => {
            insights.config.advanced_disable_feature_flags_on_first_load = true

            assignableWindow._INSIGHTS_REMOTE_CONFIG = {
                [insights.config.token]: {
                    config: { ...config, hasFeatureFlags: true },
                    siteApps: [],
                },
            }

            new RemoteConfigLoader(insights).load()

            expect(insights._onRemoteConfig).toHaveBeenCalledWith({ ...config, hasFeatureFlags: true })
            expect(insights.featureFlags.ensureFlagsLoaded).not.toHaveBeenCalled()
        })
    })

    describe('refresh', () => {
        it('calls reloadFeatureFlags directly without fetching config', () => {
            const loader = new RemoteConfigLoader(insights)
            loader.refresh()

            expect(insights.featureFlags.reloadFeatureFlags).toHaveBeenCalled()
            expect(insights._send_request).not.toHaveBeenCalled()
            expect(insights._onRemoteConfig).not.toHaveBeenCalled()
        })

        it('is a no-op when flags are disabled', () => {
            insights._shouldDisableFlags = () => true

            const loader = new RemoteConfigLoader(insights)
            loader.refresh()

            expect(insights.featureFlags.reloadFeatureFlags).not.toHaveBeenCalled()
        })
    })

    describe('stop', () => {
        it('clears the refresh interval after load', () => {
            assignableWindow._INSIGHTS_REMOTE_CONFIG = {
                [insights.config.token]: {
                    config: { surveys: true } as RemoteConfig,
                    siteApps: [],
                },
            }

            const loader = new RemoteConfigLoader(insights)
            loader.load()

            jest.advanceTimersByTime(5 * 60 * 1000)
            expect(insights.featureFlags.reloadFeatureFlags).toHaveBeenCalledTimes(1)

            loader.stop()

            jest.advanceTimersByTime(5 * 60 * 1000)
            // Should not be called again after stop
            expect(insights.featureFlags.reloadFeatureFlags).toHaveBeenCalledTimes(1)
        })
    })

    describe('visibility-aware refresh', () => {
        const config = { surveys: true } as RemoteConfig

        beforeEach(() => {
            assignableWindow._INSIGHTS_REMOTE_CONFIG = {
                [insights.config.token]: { config, siteApps: [] },
            }
        })

        it('skips refresh when the tab is hidden', () => {
            const loader = new RemoteConfigLoader(insights)
            loader.load()

            // Simulate hiding the tab before the interval fires
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

            // Interval fires while hidden — should be a no-op
            jest.advanceTimersByTime(5 * 60 * 1000)
            expect(insights.featureFlags.reloadFeatureFlags).not.toHaveBeenCalled()

            loader.stop()
            Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        })

        it('refreshes when tab becomes visible and interval fires', () => {
            const loader = new RemoteConfigLoader(insights)
            loader.load()

            // Simulate hiding the tab
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

            // Interval fires while hidden — no refresh
            jest.advanceTimersByTime(5 * 60 * 1000)
            expect(insights.featureFlags.reloadFeatureFlags).not.toHaveBeenCalled()

            // Tab becomes visible
            Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

            // Next interval fires while visible — should refresh
            jest.advanceTimersByTime(5 * 60 * 1000)
            expect(insights.featureFlags.reloadFeatureFlags).toHaveBeenCalledTimes(1)

            loader.stop()
        })
    })

    describe('configurable refresh interval', () => {
        const config = { surveys: true } as RemoteConfig

        beforeEach(() => {
            assignableWindow._INSIGHTS_REMOTE_CONFIG = {
                [insights.config.token]: { config, siteApps: [] },
            }
        })

        it('uses custom refresh interval when configured', () => {
            const customInterval = 10 * 60 * 1000 // 10 minutes
            insights.config.remote_config_refresh_interval_ms = customInterval

            const loader = new RemoteConfigLoader(insights)
            loader.load()

            // Default interval (5 min) should not trigger refresh
            jest.advanceTimersByTime(5 * 60 * 1000)
            expect(insights.featureFlags.reloadFeatureFlags).not.toHaveBeenCalled()

            // Custom interval (10 min) should trigger refresh
            jest.advanceTimersByTime(5 * 60 * 1000) // total: 10 minutes
            expect(insights.featureFlags.reloadFeatureFlags).toHaveBeenCalledTimes(1)

            loader.stop()
        })

        it('disables periodic refresh when interval is 0', () => {
            insights.config.remote_config_refresh_interval_ms = 0

            const loader = new RemoteConfigLoader(insights)
            loader.load()

            // Even after a long time, no refresh should occur
            jest.advanceTimersByTime(30 * 60 * 1000) // 30 minutes
            expect(insights.featureFlags.reloadFeatureFlags).not.toHaveBeenCalled()

            loader.stop()
        })

        it('uses default interval when config is undefined', () => {
            insights.config.remote_config_refresh_interval_ms = undefined

            const loader = new RemoteConfigLoader(insights)
            loader.load()

            // Should use default 5 minute interval
            jest.advanceTimersByTime(5 * 60 * 1000)
            expect(insights.featureFlags.reloadFeatureFlags).toHaveBeenCalledTimes(1)

            loader.stop()
        })
    })
})
