import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { Insights, InsightsProvider } from '../../context'
import { InsightsCaptureOnViewed } from '../'
import '@testing-library/jest-dom'

describe('InsightsCaptureOnViewed component', () => {
    let mockObserverCallback: any = null

    let fakeInsights: Insights

    beforeEach(() => {
        fakeInsights = {
            capture: jest.fn(),
        } as unknown as Insights

        const mockIntersectionObserver = jest.fn((callback) => {
            mockObserverCallback = callback
            return {
                observe: jest.fn(),
                unobserve: jest.fn(),
                disconnect: jest.fn(),
            }
        })

        mockIntersectionObserver.prototype = {}
        // eslint-disable-next-line compat/compat
        window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver
    })

    it('should render children', () => {
        render(
            <InsightsProvider client={fakeInsights}>
                <InsightsCaptureOnViewed name="test-element">
                    <div data-testid="child">Hello</div>
                </InsightsCaptureOnViewed>
            </InsightsProvider>
        )

        expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('should track when element comes into view', () => {
        render(
            <InsightsProvider client={fakeInsights}>
                <InsightsCaptureOnViewed name="test-element">
                    <div data-testid="child">Hello</div>
                </InsightsCaptureOnViewed>
            </InsightsProvider>
        )

        expect(fakeInsights.capture).not.toHaveBeenCalled()

        mockObserverCallback([{ isIntersecting: true }])

        expect(fakeInsights.capture).toHaveBeenCalledWith('$element_viewed', {
            element_name: 'test-element',
        })
        expect(fakeInsights.capture).toHaveBeenCalledTimes(1)
    })

    it('should only track visibility once', () => {
        render(
            <InsightsProvider client={fakeInsights}>
                <InsightsCaptureOnViewed name="test-element">
                    <div data-testid="child">Hello</div>
                </InsightsCaptureOnViewed>
            </InsightsProvider>
        )

        mockObserverCallback([{ isIntersecting: true }])
        expect(fakeInsights.capture).toHaveBeenCalledTimes(1)

        mockObserverCallback([{ isIntersecting: true }])
        mockObserverCallback([{ isIntersecting: true }])
        expect(fakeInsights.capture).toHaveBeenCalledTimes(1)
    })

    it('should include custom properties', () => {
        render(
            <InsightsProvider client={fakeInsights}>
                <InsightsCaptureOnViewed name="test-element" properties={{ category: 'hero', priority: 'high' }}>
                    <div data-testid="child">Hello</div>
                </InsightsCaptureOnViewed>
            </InsightsProvider>
        )

        mockObserverCallback([{ isIntersecting: true }])

        expect(fakeInsights.capture).toHaveBeenCalledWith('$element_viewed', {
            element_name: 'test-element',
            category: 'hero',
            priority: 'high',
        })
    })

    it('should not track when element is not intersecting', () => {
        render(
            <InsightsProvider client={fakeInsights}>
                <InsightsCaptureOnViewed name="test-element">
                    <div data-testid="child">Hello</div>
                </InsightsCaptureOnViewed>
            </InsightsProvider>
        )

        mockObserverCallback([{ isIntersecting: false }])

        expect(fakeInsights.capture).not.toHaveBeenCalled()
    })
})
