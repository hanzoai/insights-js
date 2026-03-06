import { InsightsPersistedProperty } from '@/types'
import { createTestClient, InsightsCoreTestClient, InsightsCoreTestClientMocks } from '@/testing'

describe('Insights Core', () => {
  let insights: InsightsCoreTestClient
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mocks: InsightsCoreTestClientMocks

  jest.useFakeTimers()

  beforeEach(() => {
    ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 5 })
  })

  describe('optOut', () => {
    it('should be optedIn by default', async () => {
      expect(insights.optedOut).toEqual(false)
    })

    it('should be able to init disabled', async () => {
      ;[insights, mocks] = createTestClient('TEST_API_KEY', { defaultOptIn: false })
      expect(insights.optedOut).toEqual(true)
    })

    it('should opt in/out when called', async () => {
      ;[insights, mocks] = createTestClient('TEST_API_KEY', { defaultOptIn: false })
      insights.optOut()
      expect(insights.optedOut).toEqual(true)
      insights.optIn()
      expect(insights.optedOut).toEqual(false)
    })

    it('should persist enabled state when called', async () => {
      ;[insights, mocks] = createTestClient('TEST_API_KEY', { defaultOptIn: false })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.OptedOut)).toEqual(undefined)
      insights.optOut()
      expect(insights.getPersistedProperty(InsightsPersistedProperty.OptedOut)).toEqual(true)
      insights.optIn()
      expect(insights.getPersistedProperty(InsightsPersistedProperty.OptedOut)).toEqual(false)
    })

    it('should start in the correct state', async () => {
      ;[insights, mocks] = createTestClient('TEST_API_KEY', { defaultOptIn: false }, (mocks) => {
        mocks.storage.setItem(InsightsPersistedProperty.OptedOut, true)
      })

      expect(insights.optedOut).toEqual(true)
    })
  })
})
