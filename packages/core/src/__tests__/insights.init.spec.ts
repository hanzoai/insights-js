import { createTestClient, waitForPromises, InsightsCoreTestClient, InsightsCoreTestClientMocks } from '@/testing'

describe('Insights Core', () => {
  let insights: InsightsCoreTestClient
  let mocks: InsightsCoreTestClientMocks

  beforeEach(() => {
    ;[insights, mocks] = createTestClient('TEST_API_KEY', {})
  })

  describe('init', () => {
    it('should initialise', () => {
      expect(insights.optedOut).toEqual(false)
    })

    it('should throw if missing api key', () => {
      expect(() => createTestClient(undefined as unknown as string)).toThrowError(
        "You must pass your Insights project's api key."
      )
    })

    it('should throw if empty api key', () => {
      expect(() => createTestClient('   ')).toThrowError("You must pass your Insights project's api key.")
    })

    it('should throw if non string api key', () => {
      expect(() => createTestClient({} as string)).toThrowError("You must pass your Insights project's api key.")
    })

    it('should initialise default options', () => {
      expect(insights as any).toMatchObject({
        apiKey: 'TEST_API_KEY',
        host: 'https://us.i.insights.com',
        flushAt: 20,
        flushInterval: 10000,
      })
    })

    it('overwrites defaults with options', () => {
      ;[insights, mocks] = createTestClient('key', {
        host: 'https://a.com',
        flushAt: 1,
        flushInterval: 2,
      })

      expect(insights).toMatchObject({
        apiKey: 'key',
        host: 'https://a.com',
        flushAt: 1,
        flushInterval: 2,
      })
    })

    it('should keep the flushAt option above zero', () => {
      ;[insights, mocks] = createTestClient('key', { flushAt: -2 }) as any
      expect((insights as any).flushAt).toEqual(1)
    })

    it('should remove trailing slashes from `host`', () => {
      ;[insights, mocks] = createTestClient('TEST_API_KEY', { host: 'http://my-insights.com///' })

      expect((insights as any).host).toEqual('http://my-insights.com')
    })

    it('should use bootstrapped distinct ID when present', async () => {
      ;[insights, mocks] = createTestClient('TEST_API_KEY', { bootstrap: { distinctId: 'new_anon_id' } })

      expect((insights as any).getDistinctId()).toEqual('new_anon_id')
      expect((insights as any).getAnonymousId()).toEqual('new_anon_id')

      await insights.identify('random_id')

      expect((insights as any).getDistinctId()).toEqual('random_id')
      expect((insights as any).getAnonymousId()).toEqual('new_anon_id')
    })

    it('should use bootstrapped distinct ID as identified ID when present', async () => {
      ;[insights, mocks] = createTestClient('TEST_API_KEY', {
        bootstrap: { distinctId: 'new_id', isIdentifiedId: true },
      })
      jest.runOnlyPendingTimers()

      expect((insights as any).getDistinctId()).toEqual('new_id')
      expect((insights as any).getAnonymousId()).not.toEqual('new_id')

      await insights.identify('random_id')

      expect((insights as any).getDistinctId()).toEqual('random_id')
      expect((insights as any).getAnonymousId()).toEqual('new_id')
    })
  })

  describe('disabled', () => {
    it('should not send events when disabled', async () => {
      ;[insights, mocks] = createTestClient('TEST_API_KEY', {
        disabled: true,
        flushAt: 1,
      })
      jest.runOnlyPendingTimers()

      expect(insights.getFeatureFlags()).toEqual(undefined)
      insights.capture('test')
      insights.capture('identify')

      await waitForPromises()

      expect(mocks.fetch).not.toHaveBeenCalled()
    })
  })
})
