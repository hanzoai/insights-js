import React from 'react'
import { render } from '@testing-library/react'
import { InsightsPageView } from '../src/pages/InsightsPageView'

const mockCapture = jest.fn()
const mockUseInsights = jest.fn(() => ({ capture: mockCapture }))
jest.mock('@hanzo/insights-react', () => ({
    useInsights: () => mockUseInsights(),
}))

let mockRouter = { asPath: '/initial', isReady: true }
jest.mock('next/router.js', () => ({
    useRouter: () => mockRouter,
}))

describe('Pages InsightsPageView', () => {
    beforeEach(() => {
        mockCapture.mockClear()
        mockUseInsights.mockClear()
        mockRouter = { asPath: '/initial', isReady: true }
    })

    it('captures a $pageview event on mount', () => {
        render(<InsightsPageView />)
        expect(mockCapture).toHaveBeenCalledWith('$pageview', {
            $current_url: 'http://localhost/initial',
        })
    })

    it('includes query params and hash fragments from asPath', () => {
        mockRouter = { asPath: '/search?q=hello&page=2#section', isReady: true }
        render(<InsightsPageView />)
        expect(mockCapture).toHaveBeenCalledWith('$pageview', {
            $current_url: 'http://localhost/search?q=hello&page=2#section',
        })
    })

    it('captures a new $pageview when asPath changes', () => {
        const { rerender } = render(<InsightsPageView />)
        expect(mockCapture).toHaveBeenCalledTimes(1)

        mockRouter = { asPath: '/new-page', isReady: true }
        rerender(<InsightsPageView />)
        expect(mockCapture).toHaveBeenCalledTimes(2)
        expect(mockCapture).toHaveBeenLastCalledWith('$pageview', {
            $current_url: 'http://localhost/new-page',
        })
    })

    it('does not capture if insights client is not available', () => {
        mockUseInsights.mockReturnValueOnce(null)
        render(<InsightsPageView />)
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it('does not capture if router is not ready', () => {
        mockRouter = { asPath: '/initial', isReady: false }
        render(<InsightsPageView />)
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it('captures pageview once router becomes ready', () => {
        mockRouter = { asPath: '/initial', isReady: false }
        const { rerender } = render(<InsightsPageView />)
        expect(mockCapture).not.toHaveBeenCalled()

        mockRouter = { asPath: '/initial', isReady: true }
        rerender(<InsightsPageView />)
        expect(mockCapture).toHaveBeenCalledTimes(1)
        expect(mockCapture).toHaveBeenCalledWith('$pageview', {
            $current_url: 'http://localhost/initial',
        })
    })
})
