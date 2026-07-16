import { Insights } from '@/entrypoints/index.node'

jest.mock('../version', () => ({ version: '1.2.3' }))

const mockedFetch = jest.spyOn(globalThis, 'fetch').mockImplementation()
const DEBOUNCE_MS = 50
const HALF_DEBOUNCE_MS = DEBOUNCE_MS / 2

function getFlushedBatches(): any[][] {
  return mockedFetch.mock.calls
    .filter((c) => (c[0] as string).includes('/batch/'))
    .map((c) => JSON.parse((c[1] as any).body).batch)
}

describe('waitUntil debounced flush', () => {
  jest.useFakeTimers()

  afterEach(async () => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  describe('debounce behavior', () => {
    let insights: Insights
    let mockWaitUntil: jest.Mock

    beforeEach(() => {
      mockWaitUntil = jest.fn()
      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100, // High threshold so normal flushAt doesn't trigger
        flushInterval: 60000, // Long interval so timer doesn't trigger
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: DEBOUNCE_MS,
      })

      mockedFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () => Promise.resolve({ status: 'ok' }),
      } as any)
    })

    afterEach(async () => {
      await insights.shutdown()
    })

    it('calls waitUntil with a promise on first capture', async () => {
      insights.capture({ distinctId: 'user-1', event: 'test_event' })
      await jest.advanceTimersByTimeAsync(0)

      expect(mockWaitUntil).toHaveBeenCalledTimes(1)
      expect(mockWaitUntil).toHaveBeenCalledWith(expect.any(Promise))
    })

    it('does not call waitUntil again on subsequent captures in same batch', async () => {
      insights.capture({ distinctId: 'user-1', event: 'event_1' })
      insights.capture({ distinctId: 'user-1', event: 'event_2' })
      await jest.advanceTimersByTimeAsync(0)

      expect(mockWaitUntil).toHaveBeenCalledTimes(1)
    })

    it('flushes 50ms after the last capture', async () => {
      insights.capture({ distinctId: 'user-1', event: 'event_1' })
      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS - 1)

      expect(mockedFetch).not.toHaveBeenCalled()

      await jest.advanceTimersByTimeAsync(1)

      const batches = getFlushedBatches()
      expect(batches).toHaveLength(1)
      expect(batches[0]).toHaveLength(1)
      expect(batches[0][0].event).toBe('event_1')
    })

    it('resets debounce timer on each capture', async () => {
      insights.capture({ distinctId: 'user-1', event: 'event_1' })
      await jest.advanceTimersByTimeAsync(0)

      jest.advanceTimersByTime(DEBOUNCE_MS - 1)

      insights.capture({ distinctId: 'user-1', event: 'event_2' })
      await jest.advanceTimersByTimeAsync(0)

      jest.advanceTimersByTime(HALF_DEBOUNCE_MS)

      // Not yet flushed (only 25ms since last capture's enqueue)
      expect(mockedFetch).not.toHaveBeenCalled()

      await jest.advanceTimersByTimeAsync(HALF_DEBOUNCE_MS)

      // Now flushed with both events
      const batches = getFlushedBatches()
      expect(batches).toHaveLength(1)
      expect(batches[0]).toHaveLength(2)
    })

    it('resolves the waitUntil promise after flush completes', async () => {
      insights.capture({ distinctId: 'user-1', event: 'test_event' })
      await jest.advanceTimersByTimeAsync(0)

      const waitUntilPromise = mockWaitUntil.mock.calls[0][0] as Promise<unknown>

      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS)

      await expect(waitUntilPromise).resolves.toBeUndefined()
    })

    it('does not activate debounced flush when no waitUntil in options', async () => {
      const insightsNoWaitUntil = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
      })

      insightsNoWaitUntil.capture({ distinctId: 'user-1', event: 'test_event' })
      await jest.advanceTimersByTimeAsync(0)

      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS)

      // With flushAt=100 and only 1 event, no flush should happen from debounce
      expect(mockedFetch).not.toHaveBeenCalled()

      await insightsNoWaitUntil.shutdown()
    })

    it('starts a new debounce cycle for captures after flush', async () => {
      // First cycle
      insights.capture({ distinctId: 'user-1', event: 'event_1' })
      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS)

      // Second capture should start a new cycle
      insights.capture({ distinctId: 'user-1', event: 'event_2' })
      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS)

      expect(getFlushedBatches().length).toEqual(2)
      expect(getFlushedBatches()[0][0].event).toBe('event_1')
      expect(getFlushedBatches()[1][0].event).toBe('event_2')
    })

    it('does not flush after shutdown when debounce timer is pending', async () => {
      insights.capture({ distinctId: 'user-1', event: 'event_1' })
      await jest.advanceTimersByTimeAsync(0)

      const sentinelPromise = mockWaitUntil.mock.calls[0][0] as Promise<unknown>

      await insights.shutdown()
      mockedFetch.mockClear()

      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS * 2)
      expect(mockedFetch).not.toHaveBeenCalled()

      // Shutdown must resolve the sentinel so the serverless runtime can terminate
      await expect(sentinelPromise).resolves.toBeUndefined()
    })

    it('resolves the waitUntil promise even when flush fails', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('Network error'))

      insights.capture({ distinctId: 'user-1', event: 'test_event' })
      await jest.advanceTimersByTimeAsync(0)

      const waitUntilPromise = mockWaitUntil.mock.calls[0][0] as Promise<unknown>

      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS)

      await expect(waitUntilPromise).resolves.toBeUndefined()
    })
  })

  describe('max time cap', () => {
    let insights: Insights
    let mockWaitUntil: jest.Mock
    const MAX_DEBOUNCE_MS = 500

    beforeEach(() => {
      mockWaitUntil = jest.fn()
      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: DEBOUNCE_MS,
        waitUntilMaxWaitMs: MAX_DEBOUNCE_MS,
      })

      mockedFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () => Promise.resolve({ status: 'ok' }),
      } as any)
    })

    afterEach(async () => {
      await insights.shutdown()
    })

    it('flushes when max time cap is exceeded instead of resetting debounce', async () => {
      insights.capture({ distinctId: 'user-1', event: 'event_1' })
      await jest.advanceTimersByTimeAsync(0)

      // Advance past the max wait (default 500ms), capturing along the way
      // to keep resetting the debounce timer. Each iteration advances DEBOUNCE_MS - 1ms
      // (under the 50ms debounce) so the debounce never fires on its own.
      for (let i = 0; i < 11; i++) {
        jest.advanceTimersByTime(DEBOUNCE_MS - 1)
        insights.capture({ distinctId: 'user-1', event: `event_${i + 2}` })
        // Flush microtasks so enqueue completes. This also fires the 0ms
        // max-cap timer on the iteration where elapsed exceeds 500ms.
        await jest.advanceTimersByTimeAsync(0)
      }

      // The max cap triggered a flush during the loop (not the 50ms debounce)
      expect(getFlushedBatches().length).toEqual(1)
    })

    it('respects custom waitUntilMaxWaitMs', async () => {
      const insightsCustomMax = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: DEBOUNCE_MS,
        waitUntilMaxWaitMs: 100,
      })

      insightsCustomMax.capture({ distinctId: 'user-1', event: 'event_1' })
      await jest.advanceTimersByTimeAsync(0)

      // Advance DEBOUNCE_MS - 1ms (under the 50ms debounce) then capture again
      jest.advanceTimersByTime(DEBOUNCE_MS - 1)
      insightsCustomMax.capture({ distinctId: 'user-1', event: 'event_2' })
      await jest.advanceTimersByTimeAsync(0)

      // No flush yet — DEBOUNCE_MS - 1ms elapsed, under the 100ms custom max
      expect(getFlushedBatches()).toHaveLength(0)

      // Advance another 51ms (total 100ms) then capture — hits 100ms max
      jest.advanceTimersByTime(DEBOUNCE_MS + 1)
      insightsCustomMax.capture({ distinctId: 'user-1', event: 'event_3' })
      // This fires the 0ms max-cap timer
      await jest.advanceTimersByTimeAsync(0)

      expect(getFlushedBatches().length).toEqual(1)

      await insightsCustomMax.shutdown()
    })
  })

  describe('flush() override', () => {
    let insights: Insights
    let mockWaitUntil: jest.Mock

    beforeEach(() => {
      mockWaitUntil = jest.fn()
      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 2, // Low threshold to trigger flushAt
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: mockWaitUntil,
      })

      mockedFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () => Promise.resolve({ status: 'ok' }),
      } as any)
    })

    afterEach(async () => {
      await insights.shutdown()
    })

    it('wraps flushAt-triggered flushes in waitUntil', async () => {
      const insightsFlushAt = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 2,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: 60000, // Long debounce so it doesn't fire first
      })

      // First capture: registers debounce waitUntil sentinel
      insightsFlushAt.capture({ distinctId: 'user-1', event: 'event_1' })
      await jest.advanceTimersByTimeAsync(0)

      expect(mockWaitUntil).toHaveBeenCalledTimes(1)
      const sentinelPromise = mockWaitUntil.mock.calls[0][0] as Promise<unknown>

      // Second capture triggers flushAt (threshold is 2)
      insightsFlushAt.capture({ distinctId: 'user-1', event: 'event_2' })
      await jest.advanceTimersByTimeAsync(0)

      // flushAt-triggered flush should have sent the data
      expect(mockedFetch).toHaveBeenCalled()

      // No additional waitUntil call — debounce sentinel already keeps runtime alive
      expect(mockWaitUntil).toHaveBeenCalledTimes(1)

      await insightsFlushAt.shutdown()

      // Sentinel resolves after shutdown
      await expect(sentinelPromise).resolves.toBeUndefined()
    })

    it('wraps flushInterval-triggered flushes in waitUntil', async () => {
      const insightsWithInterval = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100, // High so flushAt doesn't trigger
        flushInterval: 500,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: 60000, // Longer than flushInterval so it doesn't fire first
      })

      insightsWithInterval.capture({ distinctId: 'user-1', event: 'event_1' })
      await jest.advanceTimersByTimeAsync(0)

      // Debounce sentinel registered on first capture
      expect(mockWaitUntil).toHaveBeenCalledTimes(1)
      const sentinelPromise = mockWaitUntil.mock.calls[0][0] as Promise<unknown>
      expect(mockedFetch).not.toHaveBeenCalled()

      // Fire the flushInterval timer (before debounce at 60s)
      await jest.advanceTimersByTimeAsync(500)

      // flushInterval-triggered flush should have sent the data
      expect(mockedFetch).toHaveBeenCalled()

      // No additional waitUntil call — debounce sentinel already keeps runtime alive
      expect(mockWaitUntil).toHaveBeenCalledTimes(1)

      await insightsWithInterval.shutdown()

      // Sentinel resolves after shutdown
      await expect(sentinelPromise).resolves.toBeUndefined()
    })

    it('wraps manual flush() calls in waitUntil when no debounce sentinel is active', async () => {
      // No captures, so no debounce sentinel registered
      mockWaitUntil.mockClear()

      await insights.flush()

      // flush() should register with waitUntil since no debounce sentinel exists
      expect(mockWaitUntil).toHaveBeenCalledTimes(1)
      expect(mockWaitUntil).toHaveBeenCalledWith(expect.any(Promise))
    })

    it('skips waitUntil registration on manual flush() when debounce sentinel is active', async () => {
      const insightsDebounce = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: 60000, // Long debounce so it doesn't fire
      })

      // Capture establishes a debounce sentinel
      insightsDebounce.capture({ distinctId: 'user-1', event: 'event_1' })
      await jest.advanceTimersByTimeAsync(0)
      expect(mockWaitUntil).toHaveBeenCalledTimes(1)

      // Manual flush() should skip waitUntil — sentinel already keeps runtime alive
      await insightsDebounce.flush()
      expect(mockWaitUntil).toHaveBeenCalledTimes(1)

      await insightsDebounce.shutdown()
    })

    it('handles waitUntil throwing', async () => {
      const throwingWaitUntil = jest.fn(() => {
        throw new Error('Not in request context')
      })
      const insightsThrowing = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: throwingWaitUntil,
      })

      insightsThrowing.capture({ distinctId: 'user-1', event: 'test_event' })
      await jest.advanceTimersByTimeAsync(0)

      // flush() should not throw even if waitUntil throws
      await expect(insightsThrowing.flush()).resolves.toBeUndefined()
    })

    it('handles waitUntil throwing during first capture scheduling', async () => {
      const throwingWaitUntil = jest.fn(() => {
        throw new Error('Not in request context')
      })
      const insightsThrowing = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: throwingWaitUntil,
        waitUntilDebounceMs: DEBOUNCE_MS,
      })

      // Should not throw even though waitUntil throws during scheduleDebouncedFlush
      expect(() => {
        insightsThrowing.capture({ distinctId: 'user-1', event: 'test_event' })
      }).not.toThrow()
    })
  })

  describe('disabled client', () => {
    it('does not schedule debounced flush when disabled', async () => {
      const mockWaitUntil = jest.fn()
      const insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        disabled: true,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: DEBOUNCE_MS,
      })

      insights.capture({ distinctId: 'user-1', event: 'test_event' })
      await jest.advanceTimersByTimeAsync(0)

      // waitUntil should never be called when client is disabled
      expect(mockWaitUntil).not.toHaveBeenCalled()

      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS)

      // No flush should have happened
      expect(mockedFetch).not.toHaveBeenCalled()

      await insights.shutdown()
    })
  })

  describe('opted out client', () => {
    it('does not schedule debounced flush when opted out', async () => {
      const mockWaitUntil = jest.fn()
      const insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        defaultOptIn: false,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: DEBOUNCE_MS,
      })

      insights.capture({ distinctId: 'user-1', event: 'test_event' })
      await jest.advanceTimersByTimeAsync(0)

      // waitUntil should never be called when client is opted out
      expect(mockWaitUntil).not.toHaveBeenCalled()

      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS)

      // No flush should have happened
      expect(mockedFetch).not.toHaveBeenCalled()

      await insights.shutdown()
    })
  })

  describe('shutdown with waitUntil', () => {
    it('flushes all queued events during shutdown', async () => {
      const mockWaitUntil = jest.fn()
      const insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: DEBOUNCE_MS,
      })

      mockedFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () => Promise.resolve({ status: 'ok' }),
      } as any)

      insights.capture({ distinctId: 'user-1', event: 'event_1' })
      insights.capture({ distinctId: 'user-1', event: 'event_2' })
      await jest.advanceTimersByTimeAsync(0)

      // No flush yet — debounce hasn't fired
      expect(mockedFetch).not.toHaveBeenCalled()

      await insights.shutdown()

      const batches = getFlushedBatches()
      expect(batches).toHaveLength(1)
      expect(batches[0]).toHaveLength(2)
      expect(batches[0][0].event).toBe('event_1')
      expect(batches[0][1].event).toBe('event_2')
    })

    it('flushes all queued events during shutdown when waitUntil throws', async () => {
      const throwingWaitUntil = jest.fn(() => {
        throw new Error('Not in request context')
      })
      const insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: throwingWaitUntil,
        waitUntilDebounceMs: DEBOUNCE_MS,
      })

      mockedFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () => Promise.resolve({ status: 'ok' }),
      } as any)

      insights.capture({ distinctId: 'user-1', event: 'event_1' })
      insights.capture({ distinctId: 'user-1', event: 'event_2' })
      await jest.advanceTimersByTimeAsync(0)

      await insights.shutdown()

      const batches = getFlushedBatches()
      expect(batches).toHaveLength(1)
      expect(batches[0]).toHaveLength(2)
      expect(batches[0][0].event).toBe('event_1')
      expect(batches[0][1].event).toBe('event_2')
    })
  })

  describe('custom debounce interval', () => {
    let insights: Insights
    let mockWaitUntil: jest.Mock

    beforeEach(() => {
      mockWaitUntil = jest.fn()
      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 100,
        flushInterval: 60000,
        fetchRetryCount: 0,
        disableCompression: true,
        waitUntil: mockWaitUntil,
        waitUntilDebounceMs: 200,
      })

      mockedFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () => Promise.resolve({ status: 'ok' }),
      } as any)
    })

    afterEach(async () => {
      await insights.shutdown()
    })

    it('does not flush before custom debounce interval elapses', async () => {
      insights.capture({ distinctId: 'user-1', event: 'test_event' })

      await jest.advanceTimersByTimeAsync(50)

      expect(mockedFetch).not.toHaveBeenCalled()
    })

    it('flushes at custom debounce interval', async () => {
      insights.capture({ distinctId: 'user-1', event: 'test_event' })

      await jest.advanceTimersByTimeAsync(200)

      expect(getFlushedBatches().length).toBe(1)
    })
  })

  describe('input validation', () => {
    it('clamps negative waitUntilDebounceMs to 0', async () => {
      const insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        waitUntilDebounceMs: -100,
        waitUntil: jest.fn(),
      })
      expect(insights.options.waitUntilDebounceMs).toBe(0)
      await insights.shutdown()
    })

    it('clamps negative waitUntilMaxWaitMs to 0', async () => {
      const insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        waitUntilMaxWaitMs: -200,
        waitUntil: jest.fn(),
      })
      expect(insights.options.waitUntilMaxWaitMs).toBe(0)
      await insights.shutdown()
    })
  })
})
