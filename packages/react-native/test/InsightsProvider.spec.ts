/** @jest-environment jsdom */
import React, { useEffect } from 'react'
import { render, cleanup } from '@testing-library/react'
import { AppState, Linking } from 'react-native'

import { InsightsProvider } from '../src/InsightsProvider'
import { useInsights } from '../src/hooks/useInsights'
import type { Insights } from '../src/insights-rn'

Linking.getInitialURL = jest.fn(() => Promise.resolve(null))
AppState.addEventListener = jest.fn()

const CaptureClient = ({ onClient }: { onClient: (client: Insights) => void }) => {
  const insights = useInsights()

  useEffect(() => {
    onClient(insights)
  }, [onClient, insights])

  return null
}

describe('InsightsProvider', () => {
  beforeEach(() => {
    ;(globalThis as any).window.fetch = jest.fn(async () => ({
      status: 200,
      json: () => Promise.resolve({ featureFlags: {} }),
    }))
  })

  afterEach(() => {
    cleanup()
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('should render a disabled client instead of throwing when the api key is %s', (_case, apiKey) => {
    const onClient = jest.fn()
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      expect(() => {
        render(
          React.createElement(
            InsightsProvider,
            { apiKey, autocapture: false, options: { persistence: 'memory' } },
            React.createElement(CaptureClient, { onClient })
          )
        )
      }).not.toThrow()

      const insights = onClient.mock.calls[0][0] as Insights
      expect(insights.isDisabled).toEqual(true)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "You must pass your Insights project's api key. The client will be disabled."
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })
})
