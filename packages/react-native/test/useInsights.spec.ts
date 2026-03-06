/** @jest-environment jsdom */
import React from 'react'
import { renderHook } from '@testing-library/react'
import { InsightsContext } from '../src/InsightsContext'
import { useInsights } from '../src/hooks/useInsights'
import type { Insights } from '../src/insights-rn'

describe('useInsights', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should return the client from context', () => {
    const mockInsights = {} as Insights
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(InsightsContext.Provider, { value: { client: mockInsights } }, children)

    const { result } = renderHook(() => useInsights(), { wrapper })

    expect(result.current).toBe(mockInsights)
  })

  it('should log error when used outside a InsightsProvider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    renderHook(() => useInsights())

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('useInsights was called without a Insights client')
    )
    consoleErrorSpy.mockRestore()
  })
})
