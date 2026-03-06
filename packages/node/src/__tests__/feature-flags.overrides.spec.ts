import { InsightsOptions } from '@/types'
import { Insights } from '@/entrypoints/index.node'
import { apiImplementation, waitForPromises } from './utils'

jest.spyOn(console, 'debug').mockImplementation()

const mockedFetch = jest.spyOn(globalThis, 'fetch').mockImplementation()

const insightsImmediateResolveOptions: InsightsOptions = {
  fetchRetryCount: 0,
}

describe('overrideFeatureFlags', () => {
  let insights: Insights

  jest.useFakeTimers()

  beforeEach(() => {
    mockedFetch.mockClear()
  })

  afterEach(async () => {
    await insights.shutdown()
  })

  describe('basic overrides', () => {
    it('should return overridden flag value instead of evaluated value', async () => {
      const flags = {
        flags: [
          {
            id: 1,
            key: 'test-flag',
            active: true,
            filters: {
              groups: [{ rollout_percentage: 0 }], // Would normally be false
            },
          },
        ],
      }
      mockedFetch.mockImplementation(apiImplementation({ localFlags: flags }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Without override, should be false (0% rollout)
      expect(await insights.getFeatureFlag('test-flag', 'user-123')).toBe(false)

      // Override the flag
      insights.overrideFeatureFlags({ 'test-flag': true })

      // Now should return the override value
      expect(await insights.getFeatureFlag('test-flag', 'user-123')).toBe(true)
    })

    it('should support string variant overrides', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      insights.overrideFeatureFlags({ 'variant-flag': 'control' })

      expect(await insights.getFeatureFlag('variant-flag', 'user-123')).toBe('control')
    })

    it('should support array syntax to enable multiple flags', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      insights.overrideFeatureFlags(['flag-a', 'flag-b', 'flag-c'])

      expect(await insights.getFeatureFlag('flag-a', 'user-123')).toBe(true)
      expect(await insights.getFeatureFlag('flag-b', 'user-123')).toBe(true)
      expect(await insights.getFeatureFlag('flag-c', 'user-123')).toBe(true)
    })

    it('should clear all overrides when passed false', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Set overrides
      insights.overrideFeatureFlags({ 'test-flag': true })
      expect(await insights.getFeatureFlag('test-flag', 'user-123')).toBe(true)

      // Clear overrides
      insights.overrideFeatureFlags(false)

      // Should return undefined (no flag exists)
      expect(await insights.getFeatureFlag('test-flag', 'user-123')).toBe(undefined)
    })

    it('should handle falsy override values correctly', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Override with false should return false, not undefined
      insights.overrideFeatureFlags({ 'disabled-flag': false })

      expect(await insights.getFeatureFlag('disabled-flag', 'user-123')).toBe(false)
    })

    it('should return undefined when flag is overridden to undefined (simulates missing flag)', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Override with undefined should return undefined (simulates flag doesn't exist)
      insights.overrideFeatureFlags({ 'undefined-flag': undefined as any })

      expect(await insights.getFeatureFlag('undefined-flag', 'user-123')).toBeUndefined()
    })
  })

  describe('payload overrides', () => {
    it('should return overridden payload value', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      insights.overrideFeatureFlags({
        flags: { 'test-flag': 'variant-a' },
        payloads: { 'test-flag': { discount: 20, message: 'Welcome!' } },
      })

      expect(await insights.getFeatureFlagPayload('test-flag', 'user-123')).toEqual({
        discount: 20,
        message: 'Welcome!',
      })
    })

    it('should support overriding only payloads without flags', async () => {
      const flags = {
        flags: [
          {
            id: 1,
            key: 'test-flag',
            active: true,
            filters: {
              groups: [{ rollout_percentage: 100 }],
            },
          },
        ],
      }
      mockedFetch.mockImplementation(apiImplementation({ localFlags: flags }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Override only payload
      insights.overrideFeatureFlags({
        payloads: { 'test-flag': { customData: true } },
      })

      // Flag should still be evaluated normally
      expect(await insights.getFeatureFlag('test-flag', 'user-123')).toBe(true)
      // But payload should be overridden
      expect(await insights.getFeatureFlagPayload('test-flag', 'user-123')).toEqual({ customData: true })
    })

    it('should support payload-only overrides with getFeatureFlagResult', async () => {
      const flags = {
        flags: [
          {
            id: 1,
            key: 'test-flag',
            active: true,
            filters: {
              groups: [{ rollout_percentage: 100 }],
              payloads: { true: { originalPayload: 'from-server' } },
            },
          },
        ],
      }
      mockedFetch.mockImplementation(apiImplementation({ localFlags: flags }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Override only payload (no flag override)
      insights.overrideFeatureFlags({
        payloads: { 'test-flag': { overriddenPayload: 'custom-value' } },
      })

      // getFeatureFlagResult should also respect the payload override
      const result = await insights.getFeatureFlagResult('test-flag', 'user-123')
      expect(result).toBeDefined()
      expect(result?.enabled).toBe(true) // Flag evaluated normally
      expect(result?.payload).toEqual({ overriddenPayload: 'custom-value' }) // Payload should be overridden
    })
  })

  describe('getAllFlags with overrides', () => {
    it('should include overridden flags in getAllFlags result', async () => {
      const flags = {
        flags: [
          {
            id: 1,
            key: 'server-flag',
            active: true,
            filters: {
              groups: [{ rollout_percentage: 100 }],
            },
          },
        ],
      }
      mockedFetch.mockImplementation(apiImplementation({ localFlags: flags }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      insights.overrideFeatureFlags({
        'override-flag': 'variant-x',
        'server-flag': false, // Override server flag
      })

      const allFlags = await insights.getAllFlags('user-123')

      expect(allFlags['override-flag']).toBe('variant-x')
      expect(allFlags['server-flag']).toBe(false) // Override takes precedence
    })
  })

  describe('isFeatureEnabled with overrides', () => {
    it('should use override value for isFeatureEnabled', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      insights.overrideFeatureFlags({ 'enabled-flag': true, 'disabled-flag': false })

      expect(await insights.isFeatureEnabled('enabled-flag', 'user-123')).toBe(true)
      expect(await insights.isFeatureEnabled('disabled-flag', 'user-123')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle flag named "flags" correctly', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // A flag named "flags" with value true should work
      insights.overrideFeatureFlags({ flags: true })

      expect(await insights.getFeatureFlag('flags', 'user-123')).toBe(true)
    })

    it('should handle flag named "payloads" correctly', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // A flag named "payloads" with value "variant-a" should work
      insights.overrideFeatureFlags({ payloads: 'variant-a' })

      expect(await insights.getFeatureFlag('payloads', 'user-123')).toBe('variant-a')
    })

    it('should handle empty string as override value', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Empty string is a falsy value but should still be returned (not undefined)
      insights.overrideFeatureFlags({ 'my-flag': '' as any })

      expect(await insights.getFeatureFlag('my-flag', 'user-123')).toBe('')
    })

    it('should replace all flag overrides when passed empty object', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Set initial overrides
      insights.overrideFeatureFlags({ 'flag-a': true, 'flag-b': 'variant' })
      expect(await insights.getFeatureFlag('flag-a', 'user-123')).toBe(true)

      // Empty object replaces with empty overrides (effectively clearing)
      insights.overrideFeatureFlags({})

      expect(await insights.getFeatureFlag('flag-a', 'user-123')).toBe(undefined)
      expect(await insights.getFeatureFlag('flag-b', 'user-123')).toBe(undefined)
    })

    it('should clear only flags when flags is false but preserve payload overrides', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Set both flag and payload overrides
      insights.overrideFeatureFlags({
        flags: { 'my-flag': 'variant-a' },
        payloads: { 'my-flag': { data: 'preserved' } },
      })

      expect(await insights.getFeatureFlag('my-flag', 'user-123')).toBe('variant-a')
      expect(await insights.getFeatureFlagPayload('my-flag', 'user-123')).toEqual({ data: 'preserved' })

      // Clear only flag overrides
      insights.overrideFeatureFlags({ flags: false })

      // Flag should be undefined, but payload should still be overridden
      expect(await insights.getFeatureFlag('my-flag', 'user-123')).toBe(undefined)
      expect(await insights.getFeatureFlagPayload('my-flag', 'user-123')).toEqual({ data: 'preserved' })
    })

    it('should clear only payloads when payloads is false but preserve flag overrides', async () => {
      mockedFetch.mockImplementation(apiImplementation({ localFlags: { flags: [] } }))

      insights = new Insights('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        ...insightsImmediateResolveOptions,
      })

      await waitForPromises()

      // Set both flag and payload overrides
      insights.overrideFeatureFlags({
        flags: { 'my-flag': 'variant-a' },
        payloads: { 'my-flag': { data: 'will-be-cleared' } },
      })

      expect(await insights.getFeatureFlag('my-flag', 'user-123')).toBe('variant-a')
      expect(await insights.getFeatureFlagPayload('my-flag', 'user-123')).toEqual({ data: 'will-be-cleared' })

      // Clear only payload overrides
      insights.overrideFeatureFlags({ payloads: false })

      // Flag should still be overridden, but payload should fall back to evaluation (null = not found)
      expect(await insights.getFeatureFlag('my-flag', 'user-123')).toBe('variant-a')
      expect(await insights.getFeatureFlagPayload('my-flag', 'user-123')).toBeNull()
    })
  })
})
