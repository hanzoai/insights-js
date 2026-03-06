import { InsightsPersistedProperty } from '@/types'
import { createTestClient, InsightsCoreTestClient, InsightsCoreTestClientMocks } from '@/testing'

describe('Insights Core', () => {
  let insights: InsightsCoreTestClient
  let mocks: InsightsCoreTestClientMocks

  beforeEach(() => {
    jest.setSystemTime(new Date('2022-01-01'))
  })

  function createSut(maxQueueSize: number = 1000, flushAt: number = 20): void {
    ;[insights, mocks] = createTestClient('TEST_API_KEY', {
      maxQueueSize: maxQueueSize,
      flushAt: flushAt,
    })
  }

  describe('enqueue', () => {
    it('should add a message to the queue', () => {
      createSut()

      insights.capture('type', {
        foo: 'bar',
      })

      expect(insights.getPersistedProperty(InsightsPersistedProperty.Queue)).toHaveLength(1)

      const item = insights.getPersistedProperty<any[]>(InsightsPersistedProperty.Queue)?.pop()

      expect(item).toMatchObject({
        message: {
          library: 'insights-core-tests',
          library_version: '2.0.0-alpha',
          type: 'capture',
          properties: {
            foo: 'bar',
          },
        },
      })

      expect(mocks.fetch).not.toHaveBeenCalled()
    })

    it('should delete oldest message if queue is full', () => {
      createSut(2, 2)

      insights.capture('type1', {
        foo: 'bar',
      })

      insights.capture('type2', {
        foo: 'bar',
      })

      insights.capture('type3', {
        foo: 'bar',
      })

      expect(insights.getPersistedProperty(InsightsPersistedProperty.Queue)).toHaveLength(2)

      let item = insights.getPersistedProperty<any[]>(InsightsPersistedProperty.Queue)?.pop()

      expect(item).toMatchObject({
        message: {
          library: 'insights-core-tests',
          library_version: '2.0.0-alpha',
          type: 'capture',
          properties: {
            foo: 'bar',
          },
          event: 'type3',
        },
      })

      item = insights.getPersistedProperty<any[]>(InsightsPersistedProperty.Queue)?.pop()

      expect(item).toMatchObject({
        message: {
          library: 'insights-core-tests',
          library_version: '2.0.0-alpha',
          type: 'capture',
          properties: {
            foo: 'bar',
          },
          event: 'type2',
        },
      })

      expect(mocks.fetch).not.toHaveBeenCalled()
    })
  })
})
