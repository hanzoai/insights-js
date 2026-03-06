import { waitForPromises, createTestClient, InsightsCoreTestClient, InsightsCoreTestClientMocks } from '@/testing'

describe('Insights Core', () => {
  let insights: InsightsCoreTestClient
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mocks: InsightsCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01'))

  beforeEach(() => {
    ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 10 })
  })

  describe('on', () => {
    it('should listen to various events', () => {
      const mock = jest.fn()
      const mockOther = jest.fn()
      insights.on('identify', mock)
      insights.on('identify', mockOther)

      insights.identify('user-1')
      expect(mock).toHaveBeenCalledTimes(1)
      expect(mockOther).toHaveBeenCalledTimes(1)
      expect(mock.mock.lastCall[0]).toMatchObject({ type: 'identify' })
    })

    it('should unsubscribe when called', () => {
      const mock = jest.fn()
      const unsubscribe = insights.on('identify', mock)

      insights.identify('user-1')
      expect(mock).toHaveBeenCalledTimes(1)
      // Calling identify with a different user should emit again
      insights.identify('user-2')
      expect(mock).toHaveBeenCalledTimes(2)
      unsubscribe()
      insights.identify('user-3')
      // Should not be called again after unsubscribe
      expect(mock).toHaveBeenCalledTimes(2)
    })

    it('should subscribe to flush events', async () => {
      const mock = jest.fn()
      insights.on('flush', mock)
      insights.capture('event')
      expect(mock).toHaveBeenCalledTimes(0)
      jest.runOnlyPendingTimers()
      await waitForPromises()
      expect(mock).toHaveBeenCalledTimes(1)
    })
  })
})
