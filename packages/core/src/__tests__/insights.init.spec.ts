import { createTestClient, waitForPromises, InsightsCoreTestClient, InsightsCoreTestClientMocks } from '@/testing'

// Force constructor-time logger calls through so they can be asserted in tests.
class InsightsCoreLoggingTestClient extends InsightsCoreTestClient {
  protected logMsgIfDebug(fn: () => void): void {
    fn()
  }
}

const createLoggingTestClient = (apiKey: string): [InsightsCoreTestClient, InsightsCoreTestClientMocks] => {
  const mocks: InsightsCoreTestClientMocks = {
    fetch: jest.fn(async () => ({
      status: 200,
      text: () => Promise.resolve('ok'),
      json: () => Promise.resolve({ status: 'ok' }),
    })),
    storage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
    },
  }

  return [new InsightsCoreLoggingTestClient(mocks, apiKey, { disableCompression: true }), mocks]
}

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

    it.each([
      ['missing', undefined as unknown as string],
      ['empty', '   '],
      ['non string', {} as string],
    ])('should disable if %s api key', (_case, apiKey) => {
      const [client, clientMocks] = createTestClient(apiKey)

      expect(client.isDisabled).toEqual(true)
      expect((client as any).apiKey).toEqual('')

      client.capture('test')

      expect(clientMocks.fetch).not.toHaveBeenCalled()
    })

    it.each([
      ['missing', undefined as unknown as string],
      ['empty', '   '],
      ['non string', {} as string],
    ])('should log when %s api key disables the client', (_case, apiKey) => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      try {
        createLoggingTestClient(apiKey)

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[Insights]',
          "You must pass your Insights project's api key. The client will be disabled."
        )
      } finally {
        consoleErrorSpy.mockRestore()
      }
    })

    it('should initialise default options', () => {
      expect(insights as any).toMatchObject({
        apiKey: 'TEST_API_KEY',
        host: 'https://insights.hanzo.ai',
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

    it.each([
      {
        name: 'trims whitespace from the api key and host',
        apiKey: '  TEST_API_KEY\n',
        host: '  http://my-insights.example.com///\t ',
        expectedApiKey: 'TEST_API_KEY',
        expectedHost: 'http://my-insights.example.com',
      },
      {
        name: 'defaults a blank host after trimming whitespace',
        apiKey: 'TEST_API_KEY',
        host: ' \n\t ',
        expectedApiKey: 'TEST_API_KEY',
        expectedHost: 'https://insights.hanzo.ai',
      },
    ])('should $name', ({ apiKey, host, expectedApiKey, expectedHost }) => {
      ;[insights, mocks] = createTestClient(apiKey, { host })

      expect((insights as any).apiKey).toEqual(expectedApiKey)
      expect((insights as any).host).toEqual(expectedHost)
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
