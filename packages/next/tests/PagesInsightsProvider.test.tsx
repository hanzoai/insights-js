import React from 'react'
import { render, screen } from '@testing-library/react'
import { InsightsProvider } from '../src/pages/InsightsProvider'

const mockClientInsightsProvider = jest.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="client-provider">{children}</div>
))
jest.mock('../src/client/ClientInsightsProvider', () => ({
    ClientInsightsProvider: (props: any) => mockClientInsightsProvider(props),
}))

describe('Pages InsightsProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders children inside ClientInsightsProvider', () => {
        render(
            <InsightsProvider apiKey="phc_test123">
                <div data-testid="child">Hello</div>
            </InsightsProvider>
        )
        expect(screen.getByTestId('client-provider')).toBeInTheDocument()
        expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('passes apiKey to ClientInsightsProvider', () => {
        render(
            <InsightsProvider apiKey="phc_test123">
                <div>Child</div>
            </InsightsProvider>
        )
        expect(mockClientInsightsProvider).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'phc_test123' }))
    })

    it('warns and renders children without ClientInsightsProvider when apiKey is empty and env var is not set', () => {
        delete process.env.NEXT_PUBLIC_INSIGHTS_KEY
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

        render(
            <InsightsProvider apiKey="">
                <div data-testid="child">Child</div>
            </InsightsProvider>
        )

        expect(screen.getByTestId('child')).toBeInTheDocument()
        expect(mockClientInsightsProvider).not.toHaveBeenCalled()
        expect(warnSpy).toHaveBeenCalledWith('[Insights Next.js] apiKey is required — Insights will not be initialized')
        warnSpy.mockRestore()
    })

    it('trims apiKey and api_host before passing them to ClientInsightsProvider', () => {
        render(
            <InsightsProvider
                apiKey={'  phc_test123\n'}
                clientOptions={{ api_host: '  https://custom.insights.example.com/\t ' }}
            >
                <div>Child</div>
            </InsightsProvider>
        )
        expect(mockClientInsightsProvider).toHaveBeenCalledWith(
            expect.objectContaining({
                apiKey: 'phc_test123',
                options: expect.objectContaining({ api_host: 'https://custom.insights.example.com/' }),
            })
        )
    })

    it('applies NEXTJS_CLIENT_DEFAULTS to options', () => {
        render(
            <InsightsProvider apiKey="phc_test123">
                <div>Child</div>
            </InsightsProvider>
        )
        expect(mockClientInsightsProvider).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    api_host: 'https://insights.hanzo.ai',
                    persistence: 'localStorage+cookie',
                    opt_out_capturing_persistence_type: 'cookie',
                    opt_out_persistence_by_default: true,
                }),
            })
        )
    })

    it('allows user clientOptions to override defaults', () => {
        render(
            <InsightsProvider apiKey="phc_test123" clientOptions={{ persistence: 'memory' }}>
                <div>Child</div>
            </InsightsProvider>
        )
        expect(mockClientInsightsProvider).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    persistence: 'memory',
                    opt_out_capturing_persistence_type: 'cookie',
                }),
            })
        )
    })

    it('resolves api_host from env when not provided', () => {
        process.env.NEXT_PUBLIC_INSIGHTS_HOST = 'https://env-host.example.com'
        render(
            <InsightsProvider apiKey="phc_test123">
                <div>Child</div>
            </InsightsProvider>
        )
        expect(mockClientInsightsProvider).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    api_host: 'https://env-host.example.com',
                }),
            })
        )
        delete process.env.NEXT_PUBLIC_INSIGHTS_HOST
    })

    it('trims apiKey and api_host from env vars', () => {
        process.env.NEXT_PUBLIC_INSIGHTS_KEY = '  phc_from_env\n'
        process.env.NEXT_PUBLIC_INSIGHTS_HOST = '  https://env-host.example.com/\t '
        render(
            <InsightsProvider>
                <div>Child</div>
            </InsightsProvider>
        )
        expect(mockClientInsightsProvider).toHaveBeenCalledWith(
            expect.objectContaining({
                apiKey: 'phc_from_env',
                options: expect.objectContaining({
                    api_host: 'https://env-host.example.com/',
                }),
            })
        )
        delete process.env.NEXT_PUBLIC_INSIGHTS_KEY
        delete process.env.NEXT_PUBLIC_INSIGHTS_HOST
    })

    it('passes bootstrap prop through to ClientInsightsProvider', () => {
        const bootstrap = { featureFlags: { 'flag-a': true } }
        render(
            <InsightsProvider apiKey="phc_test123" bootstrap={bootstrap}>
                <div>Child</div>
            </InsightsProvider>
        )
        expect(mockClientInsightsProvider).toHaveBeenCalledWith(expect.objectContaining({ bootstrap }))
    })
})
