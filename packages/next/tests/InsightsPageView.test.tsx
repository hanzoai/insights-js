import React from 'react'
import { render } from '@testing-library/react'
import { InsightsPageView } from '../src/client/InsightsPageView'

const mockCapture = jest.fn()
const mockUseInsights = jest.fn(() => ({ capture: mockCapture }))
jest.mock('@hanzo/insights-react', () => ({
    useInsights: () => mockUseInsights(),
}))

let mockPathname = '/initial'
let mockSearchParams = new URLSearchParams()
jest.mock('next/navigation.js', () => ({
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
}))

describe('InsightsPageView', () => {
    beforeEach(() => {
        mockCapture.mockClear()
        mockUseInsights.mockClear()
        mockPathname = '/initial'
        mockSearchParams = new URLSearchParams()
    })

    it('captures a $pageview event on mount', () => {
        render(<InsightsPageView />)
        expect(mockCapture).toHaveBeenCalledWith('$pageview', {
            $current_url: 'http://localhost/initial',
        })
    })

    it('includes search params in the captured URL', () => {
        mockSearchParams = new URLSearchParams('q=hello&page=2')
        render(<InsightsPageView />)
        expect(mockCapture).toHaveBeenCalledWith('$pageview', {
            $current_url: 'http://localhost/initial?q=hello&page=2',
        })
    })

    it('captures a new $pageview when pathname changes', () => {
        const { rerender } = render(<InsightsPageView />)
        expect(mockCapture).toHaveBeenCalledTimes(1)

        mockPathname = '/new-page'
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
})
