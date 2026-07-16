import { Insights } from '../src'
import { isInsightsFetchNetworkError } from '@hanzo/insights-core'

// Proves the exported instanceof guard recognizes a genuine InsightsFetchNetworkError
// produced by core's real fetch path.
describe('isInsightsFetchNetworkError recognizes real core errors', () => {
  const originalFetch = (globalThis as any).window.fetch

  beforeAll(() => {
    // The SDK flush/shutdown lifecycle is timer-driven; the suite's global fake timers
    // would deadlock awaited async operations, so use real timers here.
    jest.useRealTimers()
  })

  afterAll(() => {
    ;(globalThis as any).window.fetch = originalFetch
    jest.useFakeTimers()
  })

  it('returns true for the error core throws when fetch fails', async () => {
    ;(globalThis as any).window.fetch = jest.fn(() => {
      throw new Error('offline')
    })

    const insights = new Insights('test-token', {
      persistence: 'memory',
      flushInterval: 0,
      fetchRetryCount: 0,
    })
    await insights.ready()
    insights.capture('event')

    let caught: unknown
    try {
      await insights.flush()
    } catch (err) {
      caught = err
    }
    await insights.shutdown()

    expect(caught).toBeDefined()
    expect(isInsightsFetchNetworkError(caught)).toBe(true)
    // ordinary errors must not be mistaken for network errors
    expect(isInsightsFetchNetworkError(new Error('boom'))).toBe(false)
  }, 15000)
})
