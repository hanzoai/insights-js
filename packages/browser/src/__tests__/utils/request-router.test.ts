import { RequestRouter, RequestRouterTarget } from '../../utils/request-router'

describe('request-router', () => {
    const router = (api_host = 'https://app.insights.com', ui_host?: string) => {
        return new RequestRouter({
            config: {
                api_host,
                ui_host,
            },
        } as any)
    }

    const testCases: [string, RequestRouterTarget, string][] = [
        // US domain
        ['https://app.insights.com', 'ui', 'https://us.insights.com'],
        ['https://app.insights.com', 'assets', 'https://us-assets.i.insights.com'],
        ['https://app.insights.com', 'api', 'https://us.i.insights.com'],
        // US domain via app domain
        ['https://us.insights.com', 'ui', 'https://us.insights.com'],
        ['https://us.insights.com', 'assets', 'https://us-assets.i.insights.com'],
        ['https://us.insights.com', 'api', 'https://us.i.insights.com'],
        ['https://us.i.insights.com', 'api', 'https://us.i.insights.com'],
        ['https://us.i.insights.com', 'assets', 'https://us-assets.i.insights.com'],
        ['https://us-assets.i.insights.com', 'assets', 'https://us-assets.i.insights.com'],
        ['https://us-assets.i.insights.com', 'api', 'https://us.i.insights.com'],

        // EU domain
        ['https://eu.insights.com', 'ui', 'https://eu.insights.com'],
        ['https://eu.i.insights.com', 'ui', 'https://eu.insights.com'],
        ['https://eu.insights.com', 'assets', 'https://eu-assets.i.insights.com'],
        ['https://eu.insights.com', 'api', 'https://eu.i.insights.com'],
        ['https://eu.i.insights.com', 'api', 'https://eu.i.insights.com'],
        ['https://eu.i.insights.com', 'assets', 'https://eu-assets.i.insights.com'],
        ['https://eu-assets.i.insights.com', 'assets', 'https://eu-assets.i.insights.com'],
        ['https://eu-assets.i.insights.com', 'api', 'https://eu.i.insights.com'],

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
        ['https://app.insights.com/', 'https://us.i.insights.com/'],
        // adds trailing slash
        ['https://app.insights.com', 'https://us.i.insights.com/'],
        // accepts the empty string
        ['', '/'],
        // ignores whitespace string
        ['     ', '/'],
        ['  https://app.insights.com       ', 'https://us.i.insights.com/'],
        ['https://example.com/', 'https://example.com/'],
    ])('should sanitize the api_host values for "%s"', (apiHost, expected) => {
        expect(router(apiHost).endpointFor('api', '/flags?v=2&config=true')).toEqual(`${expected}flags?v=2&config=true`)
    })

    it('should use the ui_host if provided', () => {
        expect(router('https://my.domain.com/', 'https://eu.insights.com/').endpointFor('ui')).toEqual(
            'https://eu.insights.com'
        )

        expect(router('https://my.domain.com/', 'https://app.insights.com/').endpointFor('ui')).toEqual(
            'https://us.insights.com'
        )
    })

    it('should react to config changes', () => {
        const mockInsights = { config: { api_host: 'https://app.insights.com' } }

        const router = new RequestRouter(mockInsights as any)
        expect(router.endpointFor('api')).toEqual('https://us.i.insights.com')

        mockInsights.config.api_host = 'https://eu.insights.com'
        expect(router.endpointFor('api')).toEqual('https://eu.i.insights.com')
    })

    describe('flags_api_host configuration', () => {
        it('should use flags_api_host when set', () => {
            const mockInsights = {
                config: {
                    api_host: 'https://app.insights.com',
                    flags_api_host: 'https://example.com/feature-flags',
                },
            }
            const router = new RequestRouter(mockInsights as any)

            expect(router.endpointFor('flags', '/flags/?v=2')).toEqual('https://example.com/feature-flags/flags/?v=2')
        })

        it('should fall back to api_host when flags_api_host is not set', () => {
            const mockInsights = {
                config: {
                    api_host: 'https://app.insights.com',
                },
            }
            const router = new RequestRouter(mockInsights as any)

            expect(router.endpointFor('flags', '/flags/?v=2')).toEqual('https://us.i.insights.com/flags/?v=2')
        })

        it('should trim trailing slashes from flags_api_host', () => {
            const mockInsights = {
                config: {
                    api_host: 'https://app.insights.com',
                    flags_api_host: 'https://flags.example.com/',
                },
            }
            const router = new RequestRouter(mockInsights as any)

            expect(router.endpointFor('flags', '/flags/?v=2')).toEqual('https://flags.example.com/flags/?v=2')
        })

        it('should react to flags_api_host config changes', () => {
            const mockInsights = {
                config: {
                    api_host: 'https://app.insights.com',
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
