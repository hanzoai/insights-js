import { InsightsPersistedProperty } from '@/types'
import { createTestClient, InsightsCoreTestClient, InsightsCoreTestClientMocks } from '@/testing'

describe('Insights Core', () => {
  let insights: InsightsCoreTestClient
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mocks: InsightsCoreTestClientMocks

  const getEnrichedProperties = (): any => {
    // NOTE: Hacky override so we can just test the props functionality
    return (insights as any).enrichProperties()
  }

  beforeEach(() => {
    ;[insights, mocks] = createTestClient('TEST_API_KEY', {})
  })

  describe('register', () => {
    it('should register properties to storage', () => {
      insights.register({ foo: 'bar' })
      expect(getEnrichedProperties()).toMatchObject({ foo: 'bar' })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual({ foo: 'bar' })
      insights.register({ foo2: 'bar2' })
      expect(getEnrichedProperties()).toMatchObject({ foo: 'bar', foo2: 'bar2' })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual({ foo: 'bar', foo2: 'bar2' })
    })

    it('should unregister properties from storage', () => {
      insights.register({ foo: 'bar', foo2: 'bar2' })
      insights.unregister('foo')
      expect(getEnrichedProperties().foo).toBeUndefined()
      expect(getEnrichedProperties().foo2).toEqual('bar2')
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual({ foo2: 'bar2' })
    })

    it('should register properties only for the session', () => {
      insights.registerForSession({ foo: 'bar' })
      expect(getEnrichedProperties()).toMatchObject({ foo: 'bar' })
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual(undefined)

      insights.register({ foo: 'bar2' })
      expect(getEnrichedProperties()).toMatchObject({ foo: 'bar' })
      insights.unregisterForSession('foo')
      expect(getEnrichedProperties()).toMatchObject({ foo: 'bar2' })
    })
  })
})
