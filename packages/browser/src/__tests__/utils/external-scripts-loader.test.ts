import { RequestRouter } from '../../utils/request-router'
import { assignableWindow } from '../../utils/globals'
import { Insights } from '../../insights-core'
import '../../entrypoints/external-scripts-loader'

describe('external-scripts-loader', () => {
    afterEach(() => {
        jest.useRealTimers()
        document!.getElementsByTagName('html')![0].innerHTML = ''
    })

    describe('loadScript', () => {
        const mockInsights = {
            config: {
                api_host: 'https://us.insights.com',
                external_scripts_inject_target: 'body',
            },
            version: '1.0.0',
        } as Insights
        mockInsights.requestRouter = new RequestRouter(mockInsights)

        const callback = jest.fn()
        beforeEach(() => {
            callback.mockClear()
            delete mockInsights.config.__preview_external_dependency_versioned_paths
        })

        it('appends scripts to body by default', () => {
            const existingBodyScript = document!.createElement('script')
            existingBodyScript.id = 'framework-bundle'
            document!.body.appendChild(existingBodyScript)

            assignableWindow.__InsightsExtensions__.loadExternalDependency(mockInsights, 'recorder', callback)

            const bodyScripts = document!.querySelectorAll('body > script')
            expect(bodyScripts.length).toBe(2)
            expect(bodyScripts[0].src).toContain('recorder.js')
            expect(bodyScripts[1].id).toBe('framework-bundle')

            expect(document!.querySelectorAll('head > script').length).toBe(0)
        })

        it('appends scripts to head when configured', () => {
            mockInsights.config.external_scripts_inject_target = 'head'

            const existingBodyScript = document!.createElement('script')
            existingBodyScript.id = 'framework-bundle'
            document!.body.appendChild(existingBodyScript)

            assignableWindow.__InsightsExtensions__.loadExternalDependency(mockInsights, 'recorder', callback)

            const bodyScripts = document!.querySelectorAll('body > script')
            expect(bodyScripts.length).toBe(1)
            expect(bodyScripts[0].id).toBe('framework-bundle')

            const headScripts = document!.querySelectorAll('head > script')
            expect(headScripts.length).toBe(1)
            expect(headScripts[0].src).toContain('recorder.js')

            mockInsights.config.external_scripts_inject_target = 'body'
        })

        it('does not add duplicate scripts', () => {
            assignableWindow.__InsightsExtensions__.loadExternalDependency(mockInsights, 'recorder', callback)
            assignableWindow.__InsightsExtensions__.loadExternalDependency(mockInsights, 'recorder', callback)

            const scripts = document!.getElementsByTagName('script')
            expect(scripts.length).toBe(1)
            expect(scripts[0].src).toMatchInlineSnapshot(`"https://us-assets.i.insights.com/static/recorder.js?v=1.0.0"`)

            scripts[0].dispatchEvent(new Event('load'))
            expect(callback).toHaveBeenCalledTimes(2)
        })

        it('adds script when no preexisting scripts exist', () => {
            assignableWindow.__InsightsExtensions__.loadExternalDependency(mockInsights, 'recorder', callback)
            const scripts = document!.getElementsByTagName('script')

            expect(scripts.length).toBe(1)
            expect(scripts[0].type).toBe('text/javascript')
            expect(scripts[0].src).toMatchInlineSnapshot(`"https://us-assets.i.insights.com/static/recorder.js?v=1.0.0"`)
        })

        it('calls callback with error on failure', () => {
            assignableWindow.__InsightsExtensions__.loadExternalDependency(mockInsights, 'recorder', callback)
            document!.getElementsByTagName('script')[0].onerror!('uh-oh')
            expect(callback).toHaveBeenCalledWith('uh-oh')
        })

        it('keeps the legacy toolbar cache-busting path by default', () => {
            jest.useFakeTimers()
            jest.setSystemTime(1726067100000)
            assignableWindow.__InsightsExtensions__.loadExternalDependency(mockInsights, 'toolbar', callback)
            expect(document!.getElementsByTagName('script')[0].src).toBe(
                'https://us-assets.i.insights.com/static/toolbar.js?v=1.0.0&t=1726067100000'
            )
        })

        it.each([
            [
                'uses versioned asset paths on the normal asset host when the preview flag is enabled as a boolean',
                'https://insights.hanzo.ai',
                true,
                'https://us-assets.i.insights.hanzo.ai/static/1.0.0/recorder.js',
            ],
            [
                'uses a configured asset host override for versioned asset paths',
                'https://insights.hanzo.ai',
                'https://cdn-preview.example.com/',
                'https://cdn-preview.example.com/static/1.0.0/recorder.js',
            ],
            [
                'uses the custom asset host from endpointFor when the preview flag is enabled',
                'https://my-proxy.example.com',
                true,
                'https://my-proxy.example.com/static/1.0.0/recorder.js',
            ],
        ])('%s', (_, apiHost, previewFlag, expectedSrc) => {
            const insights = {
                config: {
                    api_host: apiHost,
                    external_scripts_inject_target: 'body',
                    __preview_external_dependency_versioned_paths: previewFlag,
                },
                version: '1.0.0',
            } as Insights
            insights.requestRouter = new RequestRouter(insights)

            assignableWindow.__InsightsExtensions__.loadExternalDependency(insights, 'recorder', callback)

            expect(document!.getElementsByTagName('script')[0].src).toBe(expectedSrc)
        })

        it('uses eu-assets on the EU region', () => {
            const euInsights = {
                config: {
                    api_host: 'https://eu.i.insights.hanzo.ai',
                    external_scripts_inject_target: 'body',
                },
                version: '1.0.0',
            } as Insights
            euInsights.requestRouter = new RequestRouter(euInsights)

            assignableWindow.__InsightsExtensions__.loadExternalDependency(euInsights, 'recorder', callback)

            expect(document!.getElementsByTagName('script')[0].src).toBe(
                'https://eu-assets.i.insights.hanzo.ai/static/recorder.js?v=1.0.0'
            )
        })

        it('allows adding nonce via prepare_external_dependency_script', () => {
            mockInsights.config.prepare_external_dependency_script = (script) => {
                script.nonce = '123'
                return script
            }

            assignableWindow.__InsightsExtensions__.loadExternalDependency(mockInsights, 'toolbar', callback)
            expect(document!.getElementsByTagName('script')[0].nonce).toBe('123')

            delete mockInsights.config.prepare_external_dependency_script
        })

        it('does not load script if prepare_external_dependency_script returns null', () => {
            mockInsights.config.prepare_external_dependency_script = () => null

            assignableWindow.__InsightsExtensions__.loadExternalDependency(mockInsights, 'toolbar', callback)
            expect(document!.getElementsByTagName('script').length).toBe(0)
            expect(callback).toHaveBeenCalledWith('prepare_external_dependency_script returned null')

            delete mockInsights.config.prepare_external_dependency_script
        })
    })

    describe('remote-config loading', () => {
        const insights = {
            config: {
                api_host: 'https://insights.hanzo.ai',
                token: 'test-token',
                external_scripts_inject_target: 'body',
            },
            version: '1.0.0',
        } as Insights
        insights.requestRouter = new RequestRouter(insights)

        const callback = jest.fn()
        beforeEach(() => {
            callback.mockClear()
        })

        it('loads remote-config from the token-specific path', () => {
            assignableWindow.__InsightsExtensions__.loadExternalDependency(insights, 'remote-config', callback)

            const scripts = document!.getElementsByTagName('script')
            expect(scripts.length).toBe(1)
            expect(scripts[0].src).toBe('https://us-assets.i.insights.hanzo.ai/array/test-token/config.js')
        })
    })
})
