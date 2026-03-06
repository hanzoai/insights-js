/** @jest-environment jsdom */
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { FeatureFlagResult } from '@hanzo/insights-core'
import { InsightsContext } from '../src/InsightsContext'
import { useFeatureFlagResult } from '../src/hooks/useFeatureFlagResult'
import type { Insights } from '../src/insights-rn'

function createMockInsights(overrides?: Partial<Pick<Insights, 'getFeatureFlagResult' | 'onFeatureFlags'>>) {
  return {
    getFeatureFlagResult: jest.fn(),
    onFeatureFlags: jest.fn(() => jest.fn()),
    ...overrides,
  } as unknown as Insights
}

describe('useFeatureFlagResult', () => {
  let mockInsights: Insights

  beforeEach(() => {
    mockInsights = createMockInsights()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(InsightsContext.Provider, { value: { client: mockInsights } }, children)

  it('should return boolean true flag result', () => {
    const expected: FeatureFlagResult = { key: 'test-flag', enabled: true }
    ;(mockInsights.getFeatureFlagResult as jest.Mock).mockReturnValue(expected)

    const { result } = renderHook(() => useFeatureFlagResult('test-flag'), { wrapper })

    expect(result.current).toEqual(expected)
    expect(mockInsights.getFeatureFlagResult).toHaveBeenCalledWith('test-flag')
  })

  it('should return boolean false flag result', () => {
    const expected: FeatureFlagResult = { key: 'test-flag', enabled: false }
    ;(mockInsights.getFeatureFlagResult as jest.Mock).mockReturnValue(expected)

    const { result } = renderHook(() => useFeatureFlagResult('test-flag'), { wrapper })

    expect(result.current).toEqual(expected)
  })

  it('should return multivariate flag result', () => {
    const expected: FeatureFlagResult = { key: 'test-flag', enabled: true, variant: 'control' }
    ;(mockInsights.getFeatureFlagResult as jest.Mock).mockReturnValue(expected)

    const { result } = renderHook(() => useFeatureFlagResult('test-flag'), { wrapper })

    expect(result.current).toEqual(expected)
  })

  it('should return flag result with payload', () => {
    const expected: FeatureFlagResult = {
      key: 'test-flag',
      enabled: true,
      variant: 'variant-a',
      payload: { color: 'blue' },
    }
    ;(mockInsights.getFeatureFlagResult as jest.Mock).mockReturnValue(expected)

    const { result } = renderHook(() => useFeatureFlagResult('test-flag'), { wrapper })

    expect(result.current).toEqual(expected)
  })

  it('should return undefined for missing flag', () => {
    ;(mockInsights.getFeatureFlagResult as jest.Mock).mockReturnValue(undefined)

    const { result } = renderHook(() => useFeatureFlagResult('missing-flag'), { wrapper })

    expect(result.current).toBeUndefined()
  })

  it('should update result when feature flags change', () => {
    let flagsCallback: (() => void) | undefined
    ;(mockInsights.onFeatureFlags as jest.Mock).mockImplementation((cb: () => void) => {
      flagsCallback = cb
      return jest.fn()
    })
    ;(mockInsights.getFeatureFlagResult as jest.Mock).mockReturnValue(undefined)

    const { result } = renderHook(() => useFeatureFlagResult('test-flag'), { wrapper })
    expect(result.current).toBeUndefined()

    const updated: FeatureFlagResult = { key: 'test-flag', enabled: true }
    ;(mockInsights.getFeatureFlagResult as jest.Mock).mockReturnValue(updated)
    act(() => {
      flagsCallback?.()
    })

    expect(result.current).toEqual(updated)
  })

  it('should unsubscribe on cleanup', () => {
    const unsubscribe = jest.fn()
    ;(mockInsights.onFeatureFlags as jest.Mock).mockReturnValue(unsubscribe)
    ;(mockInsights.getFeatureFlagResult as jest.Mock).mockReturnValue(undefined)

    const { unmount } = renderHook(() => useFeatureFlagResult('test-flag'), { wrapper })
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('should use provided client over context client', () => {
    const customClient = createMockInsights()
    ;(customClient.getFeatureFlagResult as jest.Mock).mockReturnValue({ key: 'flag', enabled: true })

    const { result } = renderHook(() => useFeatureFlagResult('flag', customClient), { wrapper })

    expect(result.current).toEqual({ key: 'flag', enabled: true })
    expect(customClient.getFeatureFlagResult).toHaveBeenCalledWith('flag')
    expect(mockInsights.getFeatureFlagResult).not.toHaveBeenCalled()
  })

  it('should log an error when no client is provided via context or prop', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useFeatureFlagResult('flag'))
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('useFeatureFlagResult was called without a Insights client')
    )
  })

  it('should work with prop client when no context provider exists', () => {
    const propClient = createMockInsights()
    ;(propClient.getFeatureFlagResult as jest.Mock).mockReturnValue({ key: 'flag', enabled: true })

    const { result } = renderHook(() => useFeatureFlagResult('flag', propClient))

    expect(result.current).toEqual({ key: 'flag', enabled: true })
    expect(propClient.getFeatureFlagResult).toHaveBeenCalledWith('flag')
  })
})
