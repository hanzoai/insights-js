import React, { useContext } from 'react'
import { render, screen } from '@testing-library/react'
import { ClientInsightsProvider } from '../src/client/ClientInsightsProvider'
import { InsightsContext, useFeatureFlagEnabled } from '@hanzo/insights-react'
import insightsJs from '@hanzo/insights'

jest.mock('@hanzo/insights', () => ({
    __esModule: true,
    default: {
        __loaded: false,
        init: jest.fn(),
        isFeatureEnabled: jest.fn(() => undefined),
        onFeatureFlags: jest.fn(() => () => {}),
    },
}))

const mockInsightsJs = insightsJs as jest.Mocked<typeof insightsJs> & { __loaded: boolean }

/** Helper component that exposes the InsightsContext value for assertions. */
function ContextReader({ onContext }: { onContext: (ctx: { client: any; bootstrap?: any }) => void }) {
    const ctx = useContext(InsightsContext)
    onContext(ctx)
    return null
}

describe('ClientInsightsProvider', () => {
    beforeEach(() => {
        ;(mockInsightsJs.init as jest.Mock).mockClear()
        ;(mockInsightsJs.isFeatureEnabled as jest.Mock).mockClear()
        ;(mockInsightsJs.onFeatureFlags as jest.Mock).mockClear()
        mockInsightsJs.__loaded = false
    })

    it('renders children', () => {
        render(
            <ClientInsightsProvider apiKey="phc_test123">
                <div data-testid="child">Hello</div>
            </ClientInsightsProvider>
        )
        expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('calls init with apiKey and options', () => {
        const options = { api_host: 'https://custom.insights.hanzo.ai' }
        render(
            <ClientInsightsProvider apiKey="phc_test123" options={options}>
                <div>Child</div>
            </ClientInsightsProvider>
        )
        expect(mockInsightsJs.init).toHaveBeenCalledWith('phc_test123', options)
    })

    it('provides insights client via context', () => {
        let contextValue: any
        render(
            <ClientInsightsProvider apiKey="phc_test123">
                <ContextReader onContext={(ctx) => (contextValue = ctx)} />
            </ClientInsightsProvider>
        )
        expect(contextValue.client).toBe(mockInsightsJs)
    })

    it('merges bootstrap into options when provided', () => {
        const bootstrap = {
            distinctID: 'user_abc',
            isIdentifiedID: true,
            featureFlags: { 'flag-a': true, 'flag-b': 'variant-1' },
        }
        render(
            <ClientInsightsProvider apiKey="phc_test123" bootstrap={bootstrap}>
                <div>Child</div>
            </ClientInsightsProvider>
        )
        expect(mockInsightsJs.init).toHaveBeenCalledWith('phc_test123', { bootstrap })
    })

    it('merges bootstrap with existing options without overwriting', () => {
        const options = { api_host: 'https://custom.insights.hanzo.ai' }
        const bootstrap = { featureFlags: { 'flag-a': true } }
        render(
            <ClientInsightsProvider apiKey="phc_test123" options={options} bootstrap={bootstrap}>
                <div>Child</div>
            </ClientInsightsProvider>
        )
        expect(mockInsightsJs.init).toHaveBeenCalledWith(
            'phc_test123',
            expect.objectContaining({
                api_host: 'https://custom.insights.hanzo.ai',
                bootstrap,
            })
        )
    })

    it('preserves existing options.bootstrap fields when merging server bootstrap', () => {
        const options = {
            bootstrap: { sessionID: 'sess_123' },
        } as any
        const bootstrap = {
            distinctID: 'user_abc',
            featureFlags: { 'flag-a': true },
        }
        render(
            <ClientInsightsProvider apiKey="phc_test123" options={options} bootstrap={bootstrap}>
                <div>Child</div>
            </ClientInsightsProvider>
        )
        expect(mockInsightsJs.init).toHaveBeenCalledWith(
            'phc_test123',
            expect.objectContaining({
                bootstrap: expect.objectContaining({
                    sessionID: 'sess_123',
                    distinctID: 'user_abc',
                    featureFlags: { 'flag-a': true },
                }),
            })
        )
    })

    it('provides bootstrap via context for SSR hook access', () => {
        const bootstrap = {
            featureFlags: { 'flag-a': true, 'flag-b': 'variant-1' },
            featureFlagPayloads: { 'flag-b': { key: 'value' } },
        }
        let contextValue: any
        render(
            <ClientInsightsProvider apiKey="phc_test123" bootstrap={bootstrap}>
                <ContextReader onContext={(ctx) => (contextValue = ctx)} />
            </ClientInsightsProvider>
        )
        expect(contextValue.bootstrap).toEqual(bootstrap)
    })

    it('context bootstrap is undefined when no bootstrap prop provided', () => {
        let contextValue: any
        render(
            <ClientInsightsProvider apiKey="phc_test123">
                <ContextReader onContext={(ctx) => (contextValue = ctx)} />
            </ClientInsightsProvider>
        )
        expect(contextValue.bootstrap).toBeUndefined()
    })

    it('does not call init when already loaded', () => {
        mockInsightsJs.__loaded = true
        render(
            <ClientInsightsProvider apiKey="phc_test123">
                <div>Child</div>
            </ClientInsightsProvider>
        )
        expect(mockInsightsJs.init).not.toHaveBeenCalled()
    })

    it('useFeatureFlagEnabled returns bootstrapped value before client loads flags', () => {
        // Simulates SSR: insights-js has no loaded flags, but bootstrap is provided.
        // The hook should fall back to the bootstrap value from context.
        const bootstrap = {
            featureFlags: { 'my-flag': true, 'my-experiment': 'variant-a' },
        }
        let flagValue: boolean | undefined
        function FlagReader() {
            flagValue = useFeatureFlagEnabled('my-flag')
            return <div data-testid="flag">{String(flagValue)}</div>
        }
        render(
            <ClientInsightsProvider apiKey="phc_test123" bootstrap={bootstrap}>
                <FlagReader />
            </ClientInsightsProvider>
        )
        expect(flagValue).toBe(true)
        expect(screen.getByTestId('flag')).toHaveTextContent('true')
    })

    it('useFeatureFlagEnabled returns undefined for unknown flag even with bootstrap', () => {
        const bootstrap = {
            featureFlags: { 'my-flag': true },
        }
        let flagValue: boolean | undefined
        function FlagReader() {
            flagValue = useFeatureFlagEnabled('unknown-flag')
            return null
        }
        render(
            <ClientInsightsProvider apiKey="phc_test123" bootstrap={bootstrap}>
                <FlagReader />
            </ClientInsightsProvider>
        )
        expect(flagValue).toBeUndefined()
    })

    it('renders children and warns when apiKey is empty', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        render(
            <ClientInsightsProvider apiKey="">
                <div data-testid="child">Child</div>
            </ClientInsightsProvider>
        )
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('apiKey is required'))
        expect(screen.getByTestId('child')).toBeInTheDocument()
        warnSpy.mockRestore()
    })
})
