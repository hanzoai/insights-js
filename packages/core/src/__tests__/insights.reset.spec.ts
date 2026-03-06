import { InsightsPersistedProperty } from '@/types'
import { createTestClient, InsightsCoreTestClient, InsightsCoreTestClientMocks } from '@/testing'

describe('Insights Core', () => {
  let insights: InsightsCoreTestClient
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mocks: InsightsCoreTestClientMocks

  beforeEach(() => {
    ;[insights, mocks] = createTestClient('TEST_API_KEY', {})
  })

  describe('reset', () => {
    it('should reset the storage when called', () => {
      const distinctId = insights.getDistinctId()
      insights.overrideFeatureFlag({
        foo: 'bar',
      })
      insights.register({
        prop: 1,
      })

      expect(insights.getPersistedProperty(InsightsPersistedProperty.AnonymousId)).toEqual(distinctId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.OverrideFeatureFlags)).toEqual({ foo: 'bar' })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual({ prop: 1 })

      insights.reset()

      expect(insights.getDistinctId()).not.toEqual(distinctId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.OverrideFeatureFlags)).toEqual(undefined)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual(undefined)
    })

    it("shouldn't reset the events capture queue", async () => {
      insights.getDistinctId()
      insights.capture('custom-event')

      const expectedQueue = [
        {
          message: expect.objectContaining({
            event: 'custom-event',
            library: 'insights-core-tests',
          }),
        },
      ]

      expect(insights.getPersistedProperty(InsightsPersistedProperty.Queue)).toEqual(expectedQueue)
      insights.reset()

      const newDistinctId = insights.getDistinctId()

      expect(insights.getPersistedProperty(InsightsPersistedProperty.Queue)).toEqual(expectedQueue)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.AnonymousId)).toEqual(newDistinctId)
    })

    it('should not reset specific props when set', () => {
      const distinctId = insights.getDistinctId()
      insights.overrideFeatureFlag({
        foo: 'bar',
      })
      insights.register({
        prop: 1,
      })

      expect(insights.getPersistedProperty(InsightsPersistedProperty.AnonymousId)).toEqual(distinctId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.OverrideFeatureFlags)).toEqual({ foo: 'bar' })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual({ prop: 1 })

      insights.reset([InsightsPersistedProperty.OverrideFeatureFlags])

      expect(insights.getDistinctId()).not.toEqual(distinctId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.OverrideFeatureFlags)).toEqual({ foo: 'bar' })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual(undefined)
    })
  })
})
