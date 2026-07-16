import { RequestRouter, RequestRouterTarget } from '../../utils/request-router'

describe('request-router', () => {
    const router = (api_host = 'https://insights.hanzo.ai', ui_host?: string) => {
        return new RequestRouter({
            config: {
                api_host,
                ui_host,
                ...configOverrides,
            },
        } as any)
    }

    const testCases: [string, RequestRouterTarget, string][] = [
        // US domain
        ['https://insights.hanzo.ai', 'ui', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'assets', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'api', 'https://insights.hanzo.ai'],
        // US domain via app domain
        ['https://insights.hanzo.ai', 'ui', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'assets', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'api', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'api', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'assets', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'assets', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'api', 'https://insights.hanzo.ai'],

        // EU domain
        ['https://insights.hanzo.ai', 'ui', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'ui', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'assets', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'api', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'api', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'assets', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'assets', 'https://insights.hanzo.ai'],
        ['https://insights.hanzo.ai', 'api', 'https://insights.hanzo.ai'],

        // custom domain
        ['https://my-custom-domain.com', 'ui', 'https://my-custom-domain.com'],
        ['https://my-custom-domain.com', 'assets', 'https://my-custom-domain.com'],
        ['https://my-custom-domain.com', 'api', 'https://my-custom-domain.com'],
    ]

    it.each(testCases)(
        'should create the appropriate endpoints for host %s and target %s',
        (host, target, expectation) => {
            expect(router(host).endpointFor(target)).toEqual(expectation)
        }
    )

    it.each([
        ['https://insights.hanzo.ai/', 'https://insights.hanzo.ai/'],
        // adds trailing slash
        ['https://insights.hanzo.ai', 'https://insights.hanzo.ai/'],
        // accepts the empty string
        ['', '/'],
        // ignores whitespace string
        ['     ', '/'],
        ['  https://insights.hanzo.ai       ', 'https://insights.hanzo.ai/'],
        ['https://example.com/', 'https://example.com/'],
    ])('should sanitize the api_host values for "%s"', (apiHost, expected) => {
        expect(router(apiHost).endpointFor('api', '/flags?v=2&config=true')).toEqual(`${expected}flags?v=2&config=true`)
    })

    it('should use the ui_host if provided', () => {
        expect(router('https://my.domain.com/', 'https://insights.hanzo.ai/').endpointFor('ui')).toEqual(
            'https://insights.hanzo.ai'
        )

        expect(router('https://my.domain.com/', 'https://insights.hanzo.ai/').endpointFor('ui')).toEqual(
            'https://insights.hanzo.ai'
        )
    })

    it('should react to config changes', () => {
        const mockInsights = { config: { api_host: 'https://insights.hanzo.ai' } }

        const router = new RequestRouter(mockInsights as any)
        expect(router.endpointFor('api')).toEqual('https://insights.hanzo.ai')

        mockInsights.config.api_host = 'https://insights.hanzo.ai'
        expect(router.endpointFor('api')).toEqual('https://insights.hanzo.ai')
    })

    describe('preview versioned asset host routing', () => {
        it.each([
            [
                'keeps exact semver asset paths on the normal US asset host when enabled as a boolean',
                'https://insights.hanzo.ai',
                true,
                '/static/1.370.0/recorder.js',
                'https://insights.hanzo.ai/static/1.370.0/recorder.js',
            ],
            [
                'keeps exact semver asset paths on the normal EU asset host when enabled as a boolean',
                'https://insights.hanzo.ai',
                true,
                '/static/1.370.0/recorder.js',
                'https://insights.hanzo.ai/static/1.370.0/recorder.js',
            ],
            [
                'accepts a string asset host override for exact semver asset paths',
                'https://insights.hanzo.ai',
                'https://cdn-preview.example.com/',
                '/static/1.370.0/recorder.js',
                'https://cdn-preview.example.com/static/1.370.0/recorder.js',
            ],
            [
                'accepts a string asset host override for compatibility asset paths',
                'https://insights.hanzo.ai',
                'https://cdn-preview.example.com/',
                '/static/recorder.js?v=1.370.0',
                'https://cdn-preview.example.com/static/recorder.js?v=1.370.0',
            ],
            [
                'lets a string asset host override win even when api_host is custom',
                'https://my-proxy.example.com',
                'https://cdn-preview.example.com',
                '/static/1.370.0/recorder.js',
                'https://cdn-preview.example.com/static/1.370.0/recorder.js',
            ],
            [
                'keeps custom asset hosts unchanged when enabled as a boolean',
                'https://my-proxy.example.com',
                true,
                '/static/1.370.0/recorder.js',
                'https://my-proxy.example.com/static/1.370.0/recorder.js',
            ],
        ])('%s', (_, apiHost, override, path, expected) => {
            expect(
                router(apiHost, undefined, {
                    __preview_external_dependency_versioned_paths: override,
                }).endpointFor('assets', path)
            ).toEqual(expected)
        })

        it('keeps non-static asset paths on the normal asset host even when a preview override is configured', () => {
            const previewRouter = router('https://insights.hanzo.ai', undefined, {
                __preview_external_dependency_versioned_paths: 'https://cdn-preview.example.com/',
            })

            expect(previewRouter.endpointFor('assets', '/array/test-token/config.js')).toEqual(
                'https://insights.hanzo.ai/array/test-token/config.js'
            )
        })
    })

    describe('flags_api_host configuration', () => {
        it('should use flags_api_host when set', () => {
            const mockInsights = {
                config: {
                    api_host: 'https://insights.hanzo.ai',
                    flags_api_host: 'https://example.com/feature-flags',
                },
            }
            const router = new RequestRouter(mockInsights as any)

            expect(router.endpointFor('flags', '/flags/?v=2')).toEqual('https://example.com/feature-flags/flags/?v=2')
        })

        it('should fall back to api_host when flags_api_host is not set', () => {
            const mockInsights = {
                config: {
                    api_host: 'https://insights.hanzo.ai',
                },
            }
            const router = new RequestRouter(mockInsights as any)

            expect(router.endpointFor('flags', '/flags/?v=2')).toEqual('https://insights.hanzo.ai/flags/?v=2')
        })

        it('should trim trailing slashes from flags_api_host', () => {
            const mockInsights = {
                config: {
                    api_host: 'https://insights.hanzo.ai',
                    flags_api_host: 'https://flags.example.com/',
                },
            }
            const router = new RequestRouter(mockInsights as any)

            expect(router.endpointFor('flags', '/flags/?v=2')).toEqual('https://flags.example.com/flags/?v=2')
        })

        it('should react to flags_api_host config changes', () => {
            const mockInsights = {
                config: {
                    api_host: 'https://insights.hanzo.ai',
                    flags_api_host: 'https://flags1.example.com',
                },
            }
            const router = new RequestRouter(mockInsights as any)

            expect(router.endpointFor('flags', '/flags/?v=2')).toEqual('https://flags1.example.com/flags/?v=2')

            mockInsights.config.flags_api_host = 'https://flags2.example.com'
            expect(router.endpointFor('flags', '/flags/?v=2')).toEqual('https://flags2.example.com/flags/?v=2')
        })

        it('should use flags_api_host even when api_host is a custom domain', () => {
            const mockInsights = {
                config: {
                    api_host: 'https://my-proxy.com',
                    flags_api_host: 'https://flags.example.com',
                },
            }
            const router = new RequestRouter(mockInsights as any)

            expect(router.endpointFor('flags', '/flags/?v=2')).toEqual('https://flags.example.com/flags/?v=2')
        })
    })
})
