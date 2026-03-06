import { Insights } from '@/entrypoints/index.node'
import { apiImplementation } from './utils'
import { waitForPromises } from './utils'

jest.mock('../version', () => ({ version: '1.2.3' }))

const mockedFetch = jest.spyOn(globalThis, 'fetch').mockImplementation()

const waitForFlush = async (): Promise<void> => {
  await waitForPromises()
  jest.runOnlyPendingTimers()
  await waitForPromises()
}

const getLastBatchEvents = (): any[] | undefined => {
  const call = mockedFetch.mock.calls.reverse().find((x) => (x[0] as string).includes('/batch/'))
  if (!call) return undefined
  return JSON.parse((call[1] as any).body as any).batch
}

describe('Insights Context', () => {
  let insights: Insights

  jest.useFakeTimers()

  beforeEach(() => {
    jest.clearAllMocks()
    insights = new Insights('TEST_API_KEY', {
      host: 'http://example.com',
      flushAt: 1,
      fetchRetryCount: 0,
      disableCompression: true,
    })

    mockedFetch.mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('ok'),
      json: () => Promise.resolve({ status: 'ok' }),
    } as any)
  })

  afterEach(async () => {
    await insights.shutdown()
  })

  it('should attach context tags to events', async () => {
    insights.withContext({ properties: { plan: 'premium', region: 'us-east' } }, () => {
      insights.capture({ distinctId: 'user-1', event: 'test_event' })
    })

    await waitForFlush()

    const events = getLastBatchEvents()
    expect(events).toHaveLength(1)
    expect(events?.[0].properties).toMatchObject({
      plan: 'premium',
      region: 'us-east',
    })
  })

  it('should allow explicit properties to override context tags', async () => {
    insights.withContext({ properties: { plan: 'free', region: 'us-west' } }, () => {
      insights.capture({
        distinctId: 'user-2',
        event: 'test_event',
        properties: { plan: 'enterprise' },
      })
    })

    await waitForFlush()

    const events = getLastBatchEvents()
    expect(events?.[0].properties).toMatchObject({
      plan: 'enterprise',
      region: 'us-west',
    })
  })

  it('should set $session_id from context sessionId', async () => {
    insights.withContext({ sessionId: 'session-123', properties: { env: 'prod' } }, () => {
      insights.capture({ distinctId: 'user-3', event: 'test_event' })
    })

    await waitForFlush()

    const events = getLastBatchEvents()
    expect(events?.[0].properties).toMatchObject({
      $session_id: 'session-123',
      env: 'prod',
    })
  })

  it('should use distinctId from context if not explicitly provided', async () => {
    insights.withContext({ distinctId: 'context-user' }, () => {
      insights.capture({ event: 'test_event' })
    })

    await waitForFlush()

    const events = getLastBatchEvents()
    expect(events?.[0].distinct_id).toBe('context-user')
  })

  it('should merge contexts by default (fresh: false)', async () => {
    insights.withContext({ properties: { outer: 'value1', shared: 'parent' } }, () => {
      insights.withContext({ properties: { inner: 'value2', shared: 'child' } }, () => {
        insights.capture({ distinctId: 'user-4', event: 'test_event' })
      })
    })

    await waitForFlush()

    const events = getLastBatchEvents()
    expect(events?.[0].properties).toMatchObject({
      outer: 'value1',
      inner: 'value2',
      shared: 'child',
    })
  })

  it('should isolate contexts when fresh: true', async () => {
    insights.withContext({ properties: { outer: 'value1' } }, () => {
      insights.withContext(
        { properties: { inner: 'value2' } },
        () => {
          insights.capture({ distinctId: 'user-5', event: 'test_event' })
        },
        { fresh: true }
      )
    })

    await waitForPromises()
    jest.runOnlyPendingTimers()
    await waitForPromises()

    const events = getLastBatchEvents()
    expect(events?.[0].properties).toMatchObject({
      inner: 'value2',
    })
    expect(events?.[0].properties.outer).toBeUndefined()
  })

  it('should merge sessionId from parent context', async () => {
    insights.withContext({ sessionId: 'session-parent', properties: { level: '1' } }, () => {
      insights.withContext({ properties: { level: '2' } }, () => {
        insights.capture({ distinctId: 'user-6', event: 'test_event' })
      })
    })

    await waitForFlush()

    const events = getLastBatchEvents()
    expect(events?.[0].properties).toMatchObject({
      $session_id: 'session-parent',
      level: '2',
    })
  })

  it('should use personless processing when no distinctId provided', async () => {
    insights.withContext({ properties: { plan: 'free' } }, () => {
      insights.capture({ event: 'test_event' })
    })

    await waitForFlush()

    const events = getLastBatchEvents()
    expect(events).toHaveLength(1)

    expect(events?.[0].distinct_id).toBeTruthy()
    expect(typeof events?.[0].distinct_id).toBe('string')
    expect(events?.[0].properties).toMatchObject({
      $process_person_profile: false,
      plan: 'free',
    })
  })

  it('should isolate contexts across 50 concurrent async operations with random delays', async () => {
    jest.useRealTimers()

    const operations = Array.from({ length: 50 }, (_, index) => {
      return insights.withContext({ properties: { index, operation: `op-${index}` } }, async () => {
        const delay = Math.floor(Math.random() * 200)

        await new Promise((r) => setTimeout(r, delay))

        insights.capture({
          distinctId: `user-${index}`,
          event: 'concurrent_test',
          properties: { step: 'after_delay' },
        })
      })
    })

    jest.useFakeTimers()

    await Promise.all(operations)

    await waitForFlush()

    const allEvents: any[] = []
    mockedFetch.mock.calls.forEach((call) => {
      if ((call[0] as string).includes('/batch/')) {
        const batch = JSON.parse((call[1] as any).body as any).batch
        allEvents.push(...batch)
      }
    })

    expect(allEvents).toHaveLength(50)

    const capturedIndices = allEvents.map((event) => event.properties.index).sort((a, b) => a - b)
    const expectedIndices = Array.from({ length: 50 }, (_, i) => i)

    expect(capturedIndices).toEqual(expectedIndices)
  })

  it('should properly inherit and restore context through nested enter/exit operations', async () => {
    // Enter context A
    insights.withContext({ properties: { contextA: 'valueA', level: 'A' } }, () => {
      // Enter context B (inherits from A by default)
      insights.withContext({ properties: { contextB: 'valueB', level: 'B' } }, () => {
        // Enter context C1 (inherits from B, which has A's stuff)
        insights.withContext({ properties: { contextC1: 'valueC1', level: 'C1' } }, () => {
          // Event 1: Should have A, B, and C1 context
          insights.capture({ distinctId: 'user-nested', event: 'event_in_C1' })
        })

        // Exit C1 - Event 2: Should have A and B, but not C1
        insights.capture({ distinctId: 'user-nested', event: 'event_after_C1' })

        // Enter context C2 (inherits from B, which still has A's stuff)
        insights.withContext({ properties: { contextC2: 'valueC2', level: 'C2' } }, () => {
          // Event 3: Should have A, B, and C2 (but not C1)
          insights.capture({ distinctId: 'user-nested', event: 'event_in_C2' })
        })

        // Exit C2 - Event 4: Should have A and B again (no C1 or C2)
        insights.capture({ distinctId: 'user-nested', event: 'event_after_C2' })
      })
    })

    await waitForFlush()

    const allEvents: any[] = []
    mockedFetch.mock.calls.forEach((call) => {
      if ((call[0] as string).includes('/batch/')) {
        const batch = JSON.parse((call[1] as any).body as any).batch
        allEvents.push(...batch)
      }
    })

    expect(allEvents).toHaveLength(4)

    // Event 1: In context C1 (has A, B, C1)
    const eventInC1 = allEvents.find((e) => e.event === 'event_in_C1')
    expect(eventInC1?.properties).toMatchObject({
      contextA: 'valueA',
      contextB: 'valueB',
      contextC1: 'valueC1',
      level: 'C1', // C1 overrides level
    })
    expect(eventInC1?.properties.contextC2).toBeUndefined()

    // Event 2: After exiting C1 (has A, B, but not C1)
    const eventAfterC1 = allEvents.find((e) => e.event === 'event_after_C1')
    expect(eventAfterC1?.properties).toMatchObject({
      contextA: 'valueA',
      contextB: 'valueB',
      level: 'B', // Back to B's level
    })
    expect(eventAfterC1?.properties.contextC1).toBeUndefined()
    expect(eventAfterC1?.properties.contextC2).toBeUndefined()

    // Event 3: In context C2 (has A, B, C2, but not C1)
    const eventInC2 = allEvents.find((e) => e.event === 'event_in_C2')
    expect(eventInC2?.properties).toMatchObject({
      contextA: 'valueA',
      contextB: 'valueB',
      contextC2: 'valueC2',
      level: 'C2', // C2 overrides level
    })
    expect(eventInC2?.properties.contextC1).toBeUndefined()

    // Event 4: After exiting C2 (has A, B again, no C1 or C2)
    const eventAfterC2 = allEvents.find((e) => e.event === 'event_after_C2')
    expect(eventAfterC2?.properties).toMatchObject({
      contextA: 'valueA',
      contextB: 'valueB',
      level: 'B', // Back to B's level again
    })
    expect(eventAfterC2?.properties.contextC1).toBeUndefined()
    expect(eventAfterC2?.properties.contextC2).toBeUndefined()
  })

  describe('enterContext', () => {
    it('should set context without a callback wrapper', async () => {
      insights.enterContext({ distinctId: 'entered-user', properties: { source: 'test' } })

      insights.capture({ event: 'test_event' })

      await waitForFlush()

      const events = getLastBatchEvents()
      expect(events).toHaveLength(1)
      expect(events?.[0].distinct_id).toBe('entered-user')
      expect(events?.[0].properties).toMatchObject({
        source: 'test',
      })
    })

    it('should merge with existing context by default', async () => {
      insights.enterContext({ distinctId: 'user-1', properties: { outer: 'value1' } })
      insights.enterContext({ properties: { inner: 'value2' } })

      insights.capture({ event: 'test_event' })

      await waitForFlush()

      const events = getLastBatchEvents()
      expect(events?.[0].distinct_id).toBe('user-1')
      expect(events?.[0].properties).toMatchObject({
        outer: 'value1',
        inner: 'value2',
      })
    })

    it('should replace context when fresh: true', async () => {
      insights.enterContext({ distinctId: 'user-1', properties: { outer: 'value1' } })
      insights.enterContext({ distinctId: 'user-2', properties: { inner: 'value2' } }, { fresh: true })

      insights.capture({ event: 'test_event' })

      await waitForFlush()

      const events = getLastBatchEvents()
      expect(events?.[0].distinct_id).toBe('user-2')
      expect(events?.[0].properties).toMatchObject({
        inner: 'value2',
      })
      expect(events?.[0].properties.outer).toBeUndefined()
    })
  })

  describe('feature flag methods with context', () => {
    it('should return undefined when calling getFeatureFlagResult without distinctId and no context', async () => {
      mockedFetch.mockImplementation(apiImplementation({ decideFlags: { 'test-flag': true } }))

      const result = await insights.getFeatureFlagResult('test-flag')

      expect(result).toBeUndefined()
    })

    it('should use distinctId from context for getFeatureFlagResult', async () => {
      mockedFetch.mockImplementation(
        apiImplementation({
          decideFlags: { 'test-flag': 'variant-a' },
          flagsPayloads: { 'test-flag': { key: 'value' } },
        })
      )

      const result = await insights.withContext({ distinctId: 'context-user' }, async () => {
        return insights.getFeatureFlagResult('test-flag')
      })

      expect(result).toMatchObject({
        key: 'test-flag',
        enabled: true,
        variant: 'variant-a',
      })

      // Verify the /flags/ call used the correct distinctId
      const flagsCall = mockedFetch.mock.calls.find((c) => (c[0] as string).includes('/flags/'))
      const body = JSON.parse((flagsCall?.[1] as any)?.body)
      expect(body.distinct_id).toBe('context-user')
    })

    it('should prefer explicit distinctId over context', async () => {
      mockedFetch.mockImplementation(apiImplementation({ decideFlags: { 'test-flag': true } }))

      await insights.withContext({ distinctId: 'context-user' }, async () => {
        await insights.getFeatureFlagResult('test-flag', 'explicit-user')
      })

      const flagsCall = mockedFetch.mock.calls.find((c) => (c[0] as string).includes('/flags/'))
      const body = JSON.parse((flagsCall?.[1] as any)?.body)
      expect(body.distinct_id).toBe('explicit-user')
    })

    it('should return empty when calling getAllFlags without distinctId and no context', async () => {
      mockedFetch.mockImplementation(apiImplementation({ decideFlags: { 'test-flag': true } }))

      const result = await insights.getAllFlags()

      expect(result).toEqual({})
    })

    it('should use distinctId from context for getAllFlags', async () => {
      mockedFetch.mockImplementation(apiImplementation({ decideFlags: { 'test-flag': 'variant-a' } }))

      const result = await insights.withContext({ distinctId: 'context-user' }, async () => {
        return insights.getAllFlags()
      })

      expect(result).toEqual({ 'test-flag': 'variant-a' })

      const flagsCall = mockedFetch.mock.calls.find((c) => (c[0] as string).includes('/flags/'))
      const body = JSON.parse((flagsCall?.[1] as any)?.body)
      expect(body.distinct_id).toBe('context-user')
    })

    it('should prefer explicit distinctId over context for getAllFlags', async () => {
      mockedFetch.mockImplementation(apiImplementation({ decideFlags: { 'test-flag': true } }))

      await insights.withContext({ distinctId: 'context-user' }, async () => {
        await insights.getAllFlags('explicit-user')
      })

      const flagsCall = mockedFetch.mock.calls.find((c) => (c[0] as string).includes('/flags/'))
      const body = JSON.parse((flagsCall?.[1] as any)?.body)
      expect(body.distinct_id).toBe('explicit-user')
    })

    it('should return empty when calling getAllFlagsAndPayloads without distinctId and no context', async () => {
      mockedFetch.mockImplementation(apiImplementation({ decideFlags: { 'test-flag': true } }))

      const result = await insights.getAllFlagsAndPayloads()

      expect(result).toEqual({ featureFlags: {}, featureFlagPayloads: {} })
    })

    it('should use distinctId from context for getAllFlagsAndPayloads', async () => {
      mockedFetch.mockImplementation(
        apiImplementation({
          decideFlags: { 'test-flag': 'variant-a' },
          flagsPayloads: { 'test-flag': { key: 'value' } },
        })
      )

      const result = await insights.withContext({ distinctId: 'context-user' }, async () => {
        return insights.getAllFlagsAndPayloads()
      })

      expect(result.featureFlags).toEqual({ 'test-flag': 'variant-a' })
      expect(result.featureFlagPayloads).toEqual({ 'test-flag': { key: 'value' } })

      const flagsCall = mockedFetch.mock.calls.find((c) => (c[0] as string).includes('/flags/'))
      const body = JSON.parse((flagsCall?.[1] as any)?.body)
      expect(body.distinct_id).toBe('context-user')
    })

    it('should prefer explicit distinctId over context for getAllFlagsAndPayloads', async () => {
      mockedFetch.mockImplementation(apiImplementation({ decideFlags: { 'test-flag': true } }))

      await insights.withContext({ distinctId: 'context-user' }, async () => {
        await insights.getAllFlagsAndPayloads('explicit-user')
      })

      const flagsCall = mockedFetch.mock.calls.find((c) => (c[0] as string).includes('/flags/'))
      const body = JSON.parse((flagsCall?.[1] as any)?.body)
      expect(body.distinct_id).toBe('explicit-user')
    })
  })
})
