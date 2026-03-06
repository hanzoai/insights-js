import * as React from 'react'
import { render, act } from '@testing-library/react'
import { InsightsProvider, Insights } from '..'
import insightsJs from '@hanzo/insights'

// Mock insights-js
jest.mock('@hanzo/insights', () => ({
    __esModule: true,
    default: {
        init: jest.fn(),
        set_config: jest.fn(),
        __loaded: false,
    },
}))

describe('InsightsProvider component', () => {
    it('should render children components', () => {
        const insights = {} as unknown as Insights
        const { getByText } = render(
            <InsightsProvider client={insights}>
                <div>Test</div>
            </InsightsProvider>
        )
        expect(getByText('Test')).toBeTruthy()
    })

    describe('when using apiKey initialization', () => {
        const apiKey = 'test-api-key'
        const initialOptions = { api_host: 'https://app.insights.hanzo.ai' }
        const updatedOptions = { api_host: 'https://eu.insights.com' }

        beforeEach(() => {
            jest.clearAllMocks()
        })

        it('should call set_config when options change', () => {
            const { rerender } = render(
                <InsightsProvider apiKey={apiKey} options={initialOptions}>
                    <div>Test</div>
                </InsightsProvider>
            )

            // First render should initialize
            expect(insightsJs.init).toHaveBeenCalledWith(apiKey, initialOptions)

            // Rerender with new options
            act(() => {
                rerender(
                    <InsightsProvider apiKey={apiKey} options={updatedOptions}>
                        <div>Test</div>
                    </InsightsProvider>
                )
            })

            // Should call set_config with new options
            expect(insightsJs.set_config).toHaveBeenCalledWith(updatedOptions)
        })

        it('should NOT call set_config when we pass new options that are the same as the previous options', () => {
            const { rerender } = render(
                <InsightsProvider apiKey={apiKey} options={initialOptions}>
                    <div>Test</div>
                </InsightsProvider>
            )

            // First render should initialize
            expect(insightsJs.init).toHaveBeenCalledWith(apiKey, initialOptions)

            // Rerender with new options
            const sameOptionsButDifferentReference = { ...initialOptions }
            act(() => {
                rerender(
                    <InsightsProvider apiKey={apiKey} options={sameOptionsButDifferentReference}>
                        <div>Test</div>
                    </InsightsProvider>
                )
            })

            // Should NOT call set_config
            expect(insightsJs.set_config).not.toHaveBeenCalled()
        })

        it('should warn when attempting to change apiKey', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
            const newApiKey = 'different-api-key'

            const { rerender } = render(
                <InsightsProvider apiKey={apiKey} options={initialOptions}>
                    <div>Test</div>
                </InsightsProvider>
            )

            // First render should initialize
            expect(insightsJs.init).toHaveBeenCalledWith(apiKey, initialOptions)

            // Rerender with new apiKey
            act(() => {
                rerender(
                    <InsightsProvider apiKey={newApiKey} options={initialOptions}>
                        <div>Test</div>
                    </InsightsProvider>
                )
            })

            // Should warn about apiKey change
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('You have provided a different `apiKey` to `InsightsProvider`')
            )

            consoleSpy.mockRestore()
        })

        it('warns if insightsJs has been loaded elsewhere', () => {
            ;(insightsJs as any).__loaded = true

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
            render(
                <InsightsProvider apiKey={apiKey} options={initialOptions}>
                    <div>Test</div>
                </InsightsProvider>
            )

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('`insights` was already loaded elsewhere. This may cause issues.')
            )

            consoleSpy.mockRestore()
            ;(insightsJs as any).__loaded = false
        })
    })
})
