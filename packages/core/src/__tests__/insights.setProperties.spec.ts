import { InsightsPersistedProperty } from '@/types'
import {
  createTestClient,
  InsightsCoreTestClient,
  InsightsCoreTestClientMocks,
  parseBody,
  waitForPromises,
} from '@/testing'

describe('Insights Core', () => {
  let insights: InsightsCoreTestClient
  let mocks: InsightsCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01'))

  beforeEach(() => {
    ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 })
  })

  describe('setGroupPropertiesForFlags', () => {
    it('should store setGroupPropertiesForFlags as persisted with group_properties key', () => {
      const props = { organisation: { name: 'bar' }, project: { name: 'baz' } }
      insights.setGroupPropertiesForFlags(props)

      expect(mocks.storage.setItem).toHaveBeenCalledWith('group_properties', props)

      expect(insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)).toEqual(props)
    })

    it('should update setGroupPropertiesForFlags appropriately', () => {
      const props = { organisation: { name: 'bar' }, project: { name: 'baz' } }
      insights.setGroupPropertiesForFlags(props)

      expect(insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)).toEqual(props)

      insights.setGroupPropertiesForFlags({ organisation: { name: 'bar2' }, project: { name2: 'baz' } })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)).toEqual({
        organisation: { name: 'bar2' },
        project: { name: 'baz', name2: 'baz' },
      })

      insights.setGroupPropertiesForFlags({ organisation2: { name: 'bar' } })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)).toEqual({
        organisation: { name: 'bar2' },
        project: { name: 'baz', name2: 'baz' },
        organisation2: { name: 'bar' },
      })
    })

    it('should clear setGroupPropertiesForFlags on reset', () => {
      const props = { organisation: { name: 'bar' }, project: { name: 'baz' } }
      insights.setGroupPropertiesForFlags(props)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)).toEqual(props)

      insights.reset()
      expect(insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)).toEqual(undefined)

      insights.setGroupPropertiesForFlags(props)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)).toEqual(props)
    })
  })

  describe('setPersonPropertiesForFlags', () => {
    it('should store setPersonPropertiesForFlags as persisted with person_properties key', () => {
      const props = { organisation: 'bar', project: 'baz' }
      insights.setPersonPropertiesForFlags(props)

      expect(mocks.storage.setItem).toHaveBeenCalledWith('person_properties', props)

      expect(insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)).toEqual(props)
    })

    it('should update setPersonPropertiesForFlags appropriately', () => {
      const props = { organisation: 'bar', project: 'baz' }
      insights.setPersonPropertiesForFlags(props)

      expect(insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)).toEqual(props)

      insights.setPersonPropertiesForFlags({ organisation: 'bar2', project2: 'baz' })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)).toEqual({
        organisation: 'bar2',
        project: 'baz',
        project2: 'baz',
      })

      insights.setPersonPropertiesForFlags({ organisation2: 'bar' })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)).toEqual({
        organisation: 'bar2',
        project: 'baz',
        project2: 'baz',
        organisation2: 'bar',
      })
    })

    it('should clear setPersonPropertiesForFlags on reset', () => {
      const props = { organisation: 'bar', project: 'baz' }
      insights.setPersonPropertiesForFlags(props)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)).toEqual(props)

      insights.reset()
      expect(insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)).toEqual(undefined)

      insights.setPersonPropertiesForFlags(props)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)).toEqual(props)
    })
  })

  describe('setPersonProperties', () => {
    it('should send a $set event with person properties', async () => {
      insights.setPersonProperties({ email: 'test@example.com' })
      await waitForPromises()

      expect(mocks.fetch).toHaveBeenCalled()
      const batchCall = mocks.fetch.mock.calls.find((call) => call[0].includes('/batch/'))
      expect(batchCall).toBeDefined()
      expect(parseBody(batchCall)).toMatchObject({
        batch: [
          {
            event: '$set',
            properties: {
              $set: { email: 'test@example.com' },
              $set_once: {},
            },
          },
        ],
      })
    })

    it('should not send duplicate $set events with the same properties', async () => {
      // First call should send the event
      insights.setPersonProperties({ email: 'test@example.com' })
      await waitForPromises()
      const callCount = mocks.fetch.mock.calls.filter((call) => call[0].includes('/batch/')).length

      // Second call with the same properties should be ignored
      insights.setPersonProperties({ email: 'test@example.com' })
      await waitForPromises()
      const newCallCount = mocks.fetch.mock.calls.filter((call) => call[0].includes('/batch/')).length

      // Should not have made an additional batch call
      expect(newCallCount).toBe(callCount)
    })

    it('should send $set event when properties change', async () => {
      // First call
      insights.setPersonProperties({ email: 'test@example.com' })
      await waitForPromises()
      const callCount = mocks.fetch.mock.calls.filter((call) => call[0].includes('/batch/')).length

      // Second call with different properties should send
      insights.setPersonProperties({ email: 'new@example.com' })
      await waitForPromises()
      const newCallCount = mocks.fetch.mock.calls.filter((call) => call[0].includes('/batch/')).length

      expect(newCallCount).toBe(callCount + 1)
    })

    it('should clear cached person properties on reset', async () => {
      // First call
      insights.setPersonProperties({ email: 'test@example.com' })
      await waitForPromises()
      const callCount = mocks.fetch.mock.calls.filter((call) => call[0].includes('/batch/')).length

      // Reset should clear the cache
      insights.reset()
      await waitForPromises()

      // Same properties should now be sent again after reset
      insights.setPersonProperties({ email: 'test@example.com' })
      await waitForPromises()
      const newCallCount = mocks.fetch.mock.calls.filter((call) => call[0].includes('/batch/')).length

      expect(newCallCount).toBeGreaterThan(callCount)
    })

    it('should send $set event when set_once properties are different', async () => {
      // First call with set_once
      insights.setPersonProperties(undefined, { signup_date: '2024-01-01' })
      await waitForPromises()
      const callCount = mocks.fetch.mock.calls.filter((call) => call[0].includes('/batch/')).length

      // Second call with same set but different set_once should send
      insights.setPersonProperties(undefined, { signup_date: '2024-01-02' })
      await waitForPromises()
      const newCallCount = mocks.fetch.mock.calls.filter((call) => call[0].includes('/batch/')).length

      expect(newCallCount).toBe(callCount + 1)
    })
  })
})
