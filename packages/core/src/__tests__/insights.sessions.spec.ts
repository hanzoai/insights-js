import { InsightsPersistedProperty } from '@/types'
import { createTestClient, InsightsCoreTestClient, InsightsCoreTestClientMocks } from '@/testing'

describe('Insights Core', () => {
  let insights: InsightsCoreTestClient
  let mocks: InsightsCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01T12:00:00'))

  beforeEach(() => {
    ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 })
  })

  describe('sessions', () => {
    it('should create a sessionId if not set', () => {
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(undefined)
      insights.capture('test')
      expect(mocks.storage.setItem).toHaveBeenCalledWith(InsightsPersistedProperty.SessionId, expect.any(String))
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(expect.any(String))
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionLastTimestamp)).toEqual(Date.now())
    })

    it('should re-use existing sessionId', () => {
      insights.setPersistedProperty(InsightsPersistedProperty.SessionId, 'test-session-id')
      const now = Date.now()
      insights.setPersistedProperty(InsightsPersistedProperty.SessionLastTimestamp, now)
      insights.setPersistedProperty(InsightsPersistedProperty.SessionStartTimestamp, now)
      insights.capture('test')
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual('test-session-id')
    })

    it('should generate new sessionId if expired', () => {
      jest.setSystemTime(new Date('2022-01-01T12:00:00'))
      insights.capture('test')
      const sessionId = insights.getPersistedProperty(InsightsPersistedProperty.SessionId)

      // Check 29 minutes later
      jest.setSystemTime(new Date('2022-01-01T12:29:00'))
      insights.capture('test')
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(sessionId)

      // Check another 29 minutes later
      jest.setSystemTime(new Date('2022-01-01T12:58:00'))
      insights.capture('test')
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(sessionId)

      // Check more than 30 minutes later
      jest.setSystemTime(new Date('2022-01-01T13:30:00'))
      insights.capture('test')
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).not.toEqual(sessionId)
    })

    it('should reset sessionId if called', () => {
      insights.capture('test')
      const sessionId = insights.getPersistedProperty(InsightsPersistedProperty.SessionId)

      insights.resetSessionId()
      insights.capture('test2')
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).not.toEqual(sessionId)
    })
  })
})
