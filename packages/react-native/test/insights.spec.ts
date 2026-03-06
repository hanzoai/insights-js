import { Insights, InsightsCustomStorage, InsightsPersistedProperty } from '../src'
import { Linking, AppState, AppStateStatus } from 'react-native'
import { waitForExpect } from './test-utils'
import { InsightsRNStorage } from '../src/storage'
import { FeatureFlagError } from '@hanzo/insights-core'

Linking.getInitialURL = jest.fn(() => Promise.resolve(null))
AppState.addEventListener = jest.fn()

describe('Insights React Native', () => {
  describe('evaluation contexts', () => {
    it('should send evaluation contexts when configured', async () => {
      insights = new Insights('test-token', {
        evaluationContexts: ['production', 'mobile'],
        flushInterval: 0,
      })
      await insights.ready()

      await insights.reloadFeatureFlagsAsync()

      expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/flags/?v=2&config=true'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"evaluation_contexts":["production","mobile"]'),
        })
      )
    })

    it('should not send evaluation contexts when not configured', async () => {
      insights = new Insights('test-token', {
        flushInterval: 0,
      })
      await insights.ready()

      await insights.reloadFeatureFlagsAsync()

      expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/flags/?v=2&config=true'),
        expect.objectContaining({
          method: 'POST',
          body: expect.not.stringContaining('evaluation_contexts'),
        })
      )
    })

    it('should not send evaluation contexts when configured as empty array', async () => {
      insights = new Insights('test-token', {
        evaluationContexts: [],
        flushInterval: 0,
      })
      await insights.ready()

      await insights.reloadFeatureFlagsAsync()

      expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/flags/?v=2&config=true'),
        expect.objectContaining({
          method: 'POST',
          body: expect.not.stringContaining('evaluation_contexts'),
        })
      )
    })

    it('should support deprecated evaluationEnvironments field', async () => {
      insights = new Insights('test-token', {
        evaluationEnvironments: ['production', 'mobile'],
        flushInterval: 0,
      })
      await insights.ready()

      await insights.reloadFeatureFlagsAsync()

      expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/flags/?v=2&config=true'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"evaluation_contexts":["production","mobile"]'),
        })
      )
    })
  })

  let mockStorage: InsightsCustomStorage
  let cache: any = {}

  jest.setTimeout(500)
  jest.useRealTimers()

  let insights: Insights

  beforeEach(() => {
    ;(globalThis as any).window.fetch = jest.fn(async (url) => {
      let res: any = { status: 'ok' }
      if (url.includes('flags')) {
        res = {
          featureFlags: {},
        }
      }

      return {
        status: 200,
        json: () => Promise.resolve(res),
      }
    })

    cache = {}
    mockStorage = {
      getItem: async (key) => {
        return cache[key] || null
      },
      setItem: async (key, value) => {
        cache[key] = value
      },
    }
  })

  afterEach(async () => {
    // This ensures there are no open promises / timers
    await insights.shutdown()
  })

  it('should initialize properly with bootstrap', async () => {
    insights = new Insights('test-token', {
      bootstrap: { distinctId: 'bar' },
      persistence: 'memory',
      flushInterval: 0,
    })

    await insights.ready()

    expect(insights.getAnonymousId()).toEqual('bar')
    expect(insights.getDistinctId()).toEqual('bar')
  })

  it('should initialize properly with bootstrap using async storage', async () => {
    insights = new Insights('test-token', {
      bootstrap: { distinctId: 'bar' },
      persistence: 'file',
      flushInterval: 0,
    })
    await insights.ready()

    expect(insights.getAnonymousId()).toEqual('bar')
    expect(insights.getDistinctId()).toEqual('bar')
  })

  it('should allow customising of native app properties', async () => {
    insights = new Insights('test-token', {
      customAppProperties: { $app_name: 'custom' },
      flushInterval: 0,
    })
    // await insights.ready()

    expect(insights.getCommonEventProperties()).toEqual({
      $lib: 'insights-react-native',
      $lib_version: expect.any(String),
      $screen_height: expect.any(Number),
      $screen_width: expect.any(Number),

      $app_name: 'custom',
    })

    const insights2 = new Insights('test-token2', {
      flushInterval: 0,
      customAppProperties: (properties) => {
        properties.$app_name = 'customised!'
        delete properties.$device_name
        return properties
      },
    })
    await insights.ready()

    expect(insights2.getCommonEventProperties()).toEqual({
      $lib: 'insights-react-native',
      $lib_version: expect.any(String),
      $screen_height: expect.any(Number),
      $screen_width: expect.any(Number),

      $app_build: 'mock',
      $app_name: 'customised!', // changed
      $app_namespace: 'mock',
      $app_version: 'mock',
      $device_manufacturer: 'mock',
      $device_type: 'Mobile',
      // $device_name: 'mock', (deleted)
      $os_name: 'mock',
      $os_version: 'mock',
      $locale: 'mock',
      $timezone: 'mock',
    })

    await insights2.shutdown()
  })

  describe('screen', () => {
    it('should set a $screen_name property on screen', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        flushInterval: 0,
      })

      await insights.screen('test-screen')

      expect((insights as any).sessionProps).toMatchObject({
        $screen_name: 'test-screen',
      })

      expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual(undefined)
    })
  })

  describe('captureAppLifecycleEvents', () => {
    it('should trigger an Application Installed event', async () => {
      // arrange
      const onCapture = jest.fn()

      // act
      insights = new Insights('1', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      insights.on('capture', onCapture)

      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(2)
        expect(onCapture.mock.calls[0][0]).toMatchObject({
          event: 'Application Installed',
          properties: {
            $app_build: '1',
            $app_version: '1.0.0',
          },
        })
        expect(onCapture.mock.calls[1][0]).toMatchObject({
          event: 'Application Opened',
          properties: {
            $app_build: '1',
            $app_version: '1.0.0',
          },
        })
      })
    })

    it('should trigger an Application Updated event', async () => {
      // arrange
      const onCapture = jest.fn()
      insights = new Insights('1', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      insights.on('capture', onCapture)

      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(2)
      })

      onCapture.mockClear()
      // act
      insights = new Insights('1', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '2',
          $app_version: '2.0.0',
        },
      })
      insights.on('capture', onCapture)

      await waitForExpect(200, () => {
        // assert
        expect(onCapture).toHaveBeenCalledTimes(2)
        expect(onCapture.mock.calls[0][0]).toMatchObject({
          event: 'Application Updated',
          properties: {
            $app_build: '2',
            $app_version: '2.0.0',
            previous_build: '1',
            previous_version: '1.0.0',
          },
        })
        expect(onCapture.mock.calls[1][0]).toMatchObject({
          event: 'Application Opened',
          properties: {
            $app_build: '2',
            $app_version: '2.0.0',
          },
        })
      })
    })

    it('should include the initial url', async () => {
      // arrange
      Linking.getInitialURL = jest.fn(() => Promise.resolve('https://example.com'))
      const onCapture = jest.fn()

      insights = new Insights('1', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      insights.on('capture', onCapture)

      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(2)
      })

      onCapture.mockClear()

      insights = new Insights('1', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      insights.on('capture', onCapture)

      // assert
      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(1)
        expect(onCapture.mock.calls[0][0]).toMatchObject({
          event: 'Application Opened',
          properties: {
            $app_build: '1',
            $app_version: '1.0.0',
            url: 'https://example.com',
          },
        })
      })
    })

    it('should track app background and foreground', async () => {
      // arrange
      const onCapture = jest.fn()
      insights = new Insights('1', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      insights.on('capture', onCapture)

      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(2)
      })

      const cb: (state: AppStateStatus) => void = (AppState.addEventListener as jest.Mock).mock.calls[1][1]

      // act
      cb('background')
      cb('active')

      // assert
      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(4)
        expect(onCapture.mock.calls[2][0]).toMatchObject({
          event: 'Application Backgrounded',
          properties: {
            $app_build: '1',
            $app_version: '1.0.0',
          },
        })
        expect(onCapture.mock.calls[3][0]).toMatchObject({
          event: 'Application Became Active',
          properties: {
            $app_build: '1',
            $app_version: '1.0.0',
          },
        })
      })
    })
  })

  describe('async initialization', () => {
    beforeEach(async () => {
      const semiAsyncStorage = new InsightsRNStorage(mockStorage)
      await semiAsyncStorage.preloadPromise
      semiAsyncStorage.setItem(InsightsPersistedProperty.AnonymousId, 'my-anonymous-id')
    })

    it('should allow immediate calls but delay for the stored values', async () => {
      const onCapture = jest.fn()
      mockStorage.setItem(InsightsPersistedProperty.AnonymousId, 'my-anonymous-id')
      insights = new Insights('1', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
      })
      insights.on('capture', onCapture)
      insights.on('identify', onCapture)

      // Should all be empty as the storage isn't ready
      expect(insights.getDistinctId()).toEqual('')
      expect(insights.getAnonymousId()).toEqual('')
      expect(insights.getSessionId()).toEqual('')

      // Fire multiple calls that have dependencies on one another
      insights.capture('anonymous event')
      insights.identify('identified-id')
      insights.capture('identified event')

      await waitForExpect(200, () => {
        expect(insights.getDistinctId()).toEqual('identified-id')
        expect(insights.getAnonymousId()).toEqual('my-anonymous-id')

        expect(onCapture).toHaveBeenCalledTimes(3)
        expect(onCapture.mock.calls[0][0]).toMatchObject({
          event: 'anonymous event',
          distinct_id: 'my-anonymous-id',
        })

        expect(onCapture.mock.calls[1][0]).toMatchObject({
          event: '$identify',
          distinct_id: 'identified-id',
          properties: {
            $anon_distinct_id: 'my-anonymous-id',
          },
        })
        expect(onCapture.mock.calls[2][0]).toMatchObject({
          event: 'identified event',
          distinct_id: 'identified-id',
          properties: {},
        })
      })
    })
  })

  describe('sync initialization', () => {
    let storage: InsightsCustomStorage
    let cache: { [key: string]: any | undefined }
    let rnStorage: InsightsRNStorage

    beforeEach(async () => {
      cache = {}
      storage = {
        getItem: jest.fn((key: string) => cache[key]),
        setItem: jest.fn((key: string, value: string) => {
          cache[key] = value
        }),
      }
      rnStorage = new InsightsRNStorage(storage)
      await rnStorage.preloadPromise
    })

    it('should allow immediate calls without delay for stored values', async () => {
      insights = new Insights('1', {
        customStorage: storage,
      })

      expect(storage.getItem).toHaveBeenCalledTimes(2)
      expect(insights.getFeatureFlag('flag')).toEqual(undefined)
      insights.overrideFeatureFlag({
        flag: true,
      })
      expect(insights.getFeatureFlag('flag')).toEqual(true)

      // New instance but same sync storage
      insights = new Insights('1', {
        customStorage: storage,
      })

      expect(storage.getItem).toHaveBeenCalledTimes(3)
      expect(insights.getFeatureFlag('flag')).toEqual(true)
    })

    it('do not rotate session id on restart', async () => {
      const sessionId = '0192244d-a627-7ae2-b22a-ccd594bed71d'
      rnStorage.setItem(InsightsPersistedProperty.SessionId, sessionId)
      const now = JSON.stringify(Date.now())
      rnStorage.setItem(InsightsPersistedProperty.SessionLastTimestamp, now)
      rnStorage.setItem(InsightsPersistedProperty.SessionStartTimestamp, now)

      insights = new Insights('1', {
        customStorage: storage,
        enablePersistSessionIdAcrossRestart: true,
      })

      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(sessionId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionLastTimestamp)).toEqual(now)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionStartTimestamp)).toEqual(now)
    })

    it('rotate session id on restart if persist session id across restart is disabled', async () => {
      const sessionId = '0192244d-a627-7ae2-b22a-ccd594bed71d'
      rnStorage.setItem(InsightsPersistedProperty.SessionId, sessionId)
      const now = JSON.stringify(Date.now())
      rnStorage.setItem(InsightsPersistedProperty.SessionLastTimestamp, now)
      rnStorage.setItem(InsightsPersistedProperty.SessionStartTimestamp, now)

      insights = new Insights('1', {
        customStorage: storage,
        enablePersistSessionIdAcrossRestart: false,
      })

      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(undefined)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionLastTimestamp)).toEqual(undefined)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionStartTimestamp)).toEqual(undefined)
    })

    it('rotate session id if expired after 30 minutes', async () => {
      const sessionId = '0192244d-a627-7ae2-b22a-ccd594bed71d'
      rnStorage.setItem(InsightsPersistedProperty.SessionId, sessionId)
      const now = Date.now()
      const nowMinus1Hour = JSON.stringify(now - 60 * 60 * 1000)
      const nowMinus45Minutes = JSON.stringify(now - 45 * 60 * 1000)
      rnStorage.setItem(InsightsPersistedProperty.SessionLastTimestamp, nowMinus45Minutes)
      rnStorage.setItem(InsightsPersistedProperty.SessionStartTimestamp, nowMinus1Hour)

      insights = new Insights('1', {
        customStorage: storage,
        enablePersistSessionIdAcrossRestart: true,
      })

      const newSessionId = insights.getSessionId()

      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).not.toEqual(sessionId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(newSessionId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionLastTimestamp)).not.toEqual(nowMinus45Minutes)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionStartTimestamp)).not.toEqual(nowMinus1Hour)
    })

    it('do not rotate session id if not expired', async () => {
      const sessionId = '0192244d-a627-7ae2-b22a-ccd594bed71d'
      rnStorage.setItem(InsightsPersistedProperty.SessionId, sessionId)
      const now = Date.now()
      const nowMinus1Hour = JSON.stringify(now - 60 * 60 * 1000)
      const nowMinus15Minutes = JSON.stringify(now - 15 * 60 * 1000)
      rnStorage.setItem(InsightsPersistedProperty.SessionLastTimestamp, nowMinus15Minutes)
      rnStorage.setItem(InsightsPersistedProperty.SessionStartTimestamp, nowMinus1Hour)

      insights = new Insights('1', {
        customStorage: storage,
        enablePersistSessionIdAcrossRestart: true,
      })

      const currentSessionId = insights.getSessionId()

      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(currentSessionId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionLastTimestamp)).not.toEqual(nowMinus15Minutes)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionStartTimestamp)).toEqual(nowMinus1Hour)
    })

    it('rotate session id if expired after 24 hours', async () => {
      const sessionId = '0192244d-a627-7ae2-b22a-ccd594bed71d'
      rnStorage.setItem(InsightsPersistedProperty.SessionId, sessionId)
      const now = Date.now()
      const nowMinus25Hour = JSON.stringify(now - 25 * 60 * 60 * 1000)
      const nowMinus15Minutes = JSON.stringify(now - 15 * 60 * 1000)
      rnStorage.setItem(InsightsPersistedProperty.SessionLastTimestamp, nowMinus15Minutes)
      rnStorage.setItem(InsightsPersistedProperty.SessionStartTimestamp, nowMinus25Hour)

      insights = new Insights('1', {
        customStorage: storage,
        enablePersistSessionIdAcrossRestart: true,
      })

      const newSessionId = insights.getSessionId()

      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).not.toEqual(sessionId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(newSessionId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionLastTimestamp)).not.toEqual(nowMinus15Minutes)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionStartTimestamp)).not.toEqual(nowMinus25Hour)
    })

    it('do not rotate session id if not expired after 24 hours', async () => {
      const sessionId = '0192244d-a627-7ae2-b22a-ccd594bed71d'
      rnStorage.setItem(InsightsPersistedProperty.SessionId, sessionId)
      const now = Date.now()
      const nowMinus23Hour = JSON.stringify(now - 23 * 60 * 60 * 1000)
      const nowMinus15Minutes = JSON.stringify(now - 15 * 60 * 1000)
      rnStorage.setItem(InsightsPersistedProperty.SessionLastTimestamp, nowMinus15Minutes)
      rnStorage.setItem(InsightsPersistedProperty.SessionStartTimestamp, nowMinus23Hour)

      insights = new Insights('1', {
        customStorage: storage,
        enablePersistSessionIdAcrossRestart: true,
      })

      const currentSessionID = insights.getSessionId()

      expect(currentSessionID).toEqual(sessionId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionId)).toEqual(sessionId)
      expect(insights.getPersistedProperty(InsightsPersistedProperty.SessionStartTimestamp)).toEqual(nowMinus23Hour)
    })
  })

  describe('person and group properties for flags', () => {
    describe('default person properties', () => {
      afterEach(() => {
        jest.restoreAllMocks()
      })

      it('should set default person properties on initialization when enabled', async () => {
        jest.spyOn(Insights.prototype, 'getCommonEventProperties').mockReturnValue({
          $lib: 'insights-react-native',
          $lib_version: '1.2.3',
        })

        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: true,
          customAppProperties: {
            $app_version: '1.0.0',
            $app_namespace: 'com.example.app',
            $device_type: 'Mobile',
            $os_name: 'iOS',
          },
        })

        await insights.ready()

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)

        expect(cachedProps).toHaveProperty('$app_version', '1.0.0')
        expect(cachedProps).toHaveProperty('$app_namespace', 'com.example.app')
        expect(cachedProps).toHaveProperty('$device_type', 'Mobile')
        expect(cachedProps).toHaveProperty('$os_name', 'iOS')
        expect(cachedProps.$lib).toBe('insights-react-native')
        expect(cachedProps.$lib_version).toBe('1.2.3')
      })

      it('should not set default person properties when disabled', async () => {
        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: false,
        })
        await insights.ready()

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)

        expect(cachedProps === undefined || Object.keys(cachedProps).length === 0).toBe(true)
      })

      it('should set default person properties by default (true)', async () => {
        insights = new Insights('test-api-key', {
          customAppProperties: {
            $device_type: 'Mobile',
          },
        })
        await insights.ready()

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)

        expect(cachedProps).toBeTruthy()
        expect(cachedProps).toHaveProperty('$device_type', 'Mobile')
      })

      it('should only include defined properties', async () => {
        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: true,
          customAppProperties: {
            $app_version: '1.0.0',
            $app_namespace: 'com.example.app',
            $device_type: 'Mobile',
            $os_name: null,
          },
        })
        await insights.ready()

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)

        expect(cachedProps).toHaveProperty('$app_version', '1.0.0')
        expect(cachedProps).toHaveProperty('$app_namespace', 'com.example.app')
        expect(cachedProps).toHaveProperty('$device_type', 'Mobile')
        expect(cachedProps).not.toHaveProperty('$os_name')
      })

      it('should restore default properties after reset()', async () => {
        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: true,
          customAppProperties: {
            $device_type: 'Mobile',
          },
        })
        await insights.ready()

        let cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps).toBeTruthy()
        expect(cachedProps).toHaveProperty('$device_type', 'Mobile')

        insights.reset()

        cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps).toBeTruthy()
        expect(cachedProps).toHaveProperty('$device_type', 'Mobile')
      })

      it('should set default properties synchronously during reset without extra reload', async () => {
        jest.spyOn(Insights.prototype, 'getCommonEventProperties').mockReturnValue({
          $lib: 'insights-react-native',
          $lib_version: '1.2.3',
        })
        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: true,
          customAppProperties: {
            $device_type: 'Mobile',
            $os_name: 'iOS',
          },
          preloadFeatureFlags: false,
        })
        await insights.ready()
        ;(globalThis as any).window.fetch.mockClear()

        insights.reset()

        // `reset` reloads flags asynchronously but does not wait for it
        // we wait for the next tick to allow the event loop to process it
        await new Promise((resolve) => setImmediate(resolve))

        const flagsCalls = (globalThis as any).window.fetch.mock.calls.filter((call: any) =>
          call[0].includes('/flags/')
        )
        expect(flagsCalls.length).toBe(1)

        const flagsCallBody = JSON.parse(flagsCalls[0][1].body)
        expect(flagsCallBody.person_properties).toEqual({
          $device_type: 'Mobile',
          $os_name: 'iOS',
          $lib: 'insights-react-native',
          $lib_version: '1.2.3',
        })
      })

      it('should merge user properties with default properties', async () => {
        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: true,
          customAppProperties: {
            $device_type: 'Mobile',
            $app_version: '1.0.0',
          },
        })
        await insights.ready()

        let cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps.$device_type).toBe('Mobile')

        insights.identify('user-123', { $device_type: 'Tablet', email: 'test@example.com' })

        cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps.$device_type).toBe('Tablet')
        expect(cachedProps.$app_version).toBe('1.0.0')
        expect(cachedProps.email).toBe('test@example.com')
      })
    })

    describe('person properties auto-caching from identify()', () => {
      beforeEach(async () => {
        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: false,
        })
        await insights.ready()
      })

      it('should cache person properties from identify() call', async () => {
        insights.identify('user-123', { email: 'test@example.com', name: 'Test User' })

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps).toEqual({ email: 'test@example.com', name: 'Test User' })
      })

      it('should merge person properties from multiple identify() calls', async () => {
        insights.identify('user-123', { email: 'test@example.com' })
        insights.identify('user-123', { name: 'Test User' })

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps).toEqual({ email: 'test@example.com', name: 'Test User' })
      })

      it('should clear person properties on reset()', async () => {
        insights.identify('user-123', { email: 'test@example.com' })
        expect(insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)).toBeTruthy()

        insights.reset()
        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps === undefined || Object.keys(cachedProps).length === 0).toBe(true)
      })

      it('should cache properties from $set when provided', async () => {
        insights.identify('user-123', {
          $set: { email: 'test@example.com', plan: 'premium' },
        })

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps).toEqual({ email: 'test@example.com', plan: 'premium' })
      })

      it('should ignore $set_once when caching properties', async () => {
        insights.identify('user-123', {
          $set: { email: 'test@example.com' },
          $set_once: { created_at: '2024-01-01' },
        })

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps).toEqual({ email: 'test@example.com' })
      })

      it('should merge properties from multiple identify() calls with $set', async () => {
        insights.identify('user-123', { $set: { email: 'test@example.com' } })
        insights.identify('user-123', { $set: { plan: 'premium' } })

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.PersonProperties)
        expect(cachedProps).toEqual({ email: 'test@example.com', plan: 'premium' })
      })

      it('should reload flags once when identify() is called with same distinctId and new properties', async () => {
        ;(globalThis as any).window.fetch = jest.fn().mockResolvedValue({ status: 200 })
        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: false,
          flushInterval: 0,
          preloadFeatureFlags: false,
        })
        const distinctId = 'user-123'
        jest.spyOn(insights, 'getDistinctId').mockReturnValue(distinctId)
        await insights.ready()
        ;(globalThis as any).window.fetch.mockClear()

        insights.identify(distinctId, { email: 'test@example.com' })

        await new Promise((resolve) => setImmediate(resolve))

        const flagsCalls = (globalThis as any).window.fetch.mock.calls.filter((call: any) =>
          call[0].includes('/flags/')
        )
        expect(flagsCalls.length).toBe(1)
      })

      it('should reload flags once when identify() is called with different distinctId', async () => {
        ;(globalThis as any).window.fetch = jest.fn().mockResolvedValue({ status: 200 })
        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: false,
          flushInterval: 0,
          preloadFeatureFlags: false,
        })
        await insights.ready()
        jest.spyOn(insights, 'getDistinctId').mockReturnValue('user-123')
        ;(globalThis as any).window.fetch.mockClear()

        insights.identify('some-new-distinct-id', { email: 'different@example.com' })

        await new Promise((resolve) => setImmediate(resolve))

        const flagsCalls = (globalThis as any).window.fetch.mock.calls.filter((call: any) =>
          call[0].includes('/flags/')
        )
        expect(flagsCalls.length).toBe(1)
      })
    })

    describe('group properties auto-caching from group()', () => {
      beforeEach(async () => {
        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: false,
        })
        await insights.ready()
      })

      it('should cache group properties from group() call', async () => {
        insights.group('company', 'acme-inc', { name: 'Acme Inc', employees: 50 })

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)
        expect(cachedProps).toEqual({ company: { name: 'Acme Inc', employees: '50' } })
      })

      it('should merge group properties from multiple group() calls', async () => {
        insights.group('company', 'acme-inc', { name: 'Acme Inc' })
        insights.group('company', 'acme-inc', { employees: 50 })

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)
        expect(cachedProps).toEqual({ company: { name: 'Acme Inc', employees: '50' } })
      })

      it('should handle multiple group types', async () => {
        insights.group('company', 'acme-inc', { name: 'Acme Inc' })
        insights.group('project', 'proj-1', { name: 'Project 1' })

        const cachedProps = insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)
        expect(cachedProps).toEqual({
          company: { name: 'Acme Inc' },
          project: { name: 'Project 1' },
        })
      })

      it('should clear group properties on reset()', async () => {
        insights.group('company', 'acme-inc', { name: 'Acme Inc' })
        expect(insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)).toBeTruthy()

        insights.reset()
        expect(insights.getPersistedProperty(InsightsPersistedProperty.GroupProperties)).toBeUndefined()
      })
    })

    describe('reloadFeatureFlags parameter', () => {
      beforeEach(async () => {
        ;(globalThis as any).window.fetch = jest.fn(async (url) => {
          let res: any = { status: 'ok' }
          if (url.includes('flags')) {
            res = {
              featureFlags: { 'test-flag': true },
            }
          }

          return {
            status: 200,
            json: () => Promise.resolve(res),
          }
        })

        insights = new Insights('test-api-key', {
          setDefaultPersonProperties: false,
          flushInterval: 0,
          preloadFeatureFlags: false,
        })
        await insights.ready()
        ;(globalThis as any).window.fetch.mockClear()
      })

      it('should reload feature flags by default when calling setPersonPropertiesForFlags', async () => {
        insights.setPersonPropertiesForFlags({ email: 'test@example.com' })

        await waitForExpect(200, () => {
          expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/flags/'),
            expect.any(Object)
          )
        })
      })

      it('should not reload feature flags when reloadFeatureFlags is false for setPersonPropertiesForFlags', async () => {
        insights.setPersonPropertiesForFlags({ email: 'test@example.com' }, false)

        await new Promise((resolve) => setTimeout(resolve, 100))

        expect((globalThis as any).window.fetch).not.toHaveBeenCalled()
      })

      it('should reload feature flags by default when calling setGroupPropertiesForFlags', async () => {
        insights.setGroupPropertiesForFlags({ company: { name: 'Acme Inc' } })

        await waitForExpect(200, () => {
          expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/flags/'),
            expect.any(Object)
          )
        })
      })

      it('should not reload feature flags when reloadFeatureFlags is false for setGroupPropertiesForFlags', async () => {
        insights.setGroupPropertiesForFlags({ company: { name: 'Acme Inc' } }, false)

        await new Promise((resolve) => setTimeout(resolve, 100))

        expect((globalThis as any).window.fetch).not.toHaveBeenCalled()
      })

      it('should reload feature flags by default when calling resetPersonPropertiesForFlags', async () => {
        insights.setPersonPropertiesForFlags({ email: 'test@example.com' }, false)
        ;(globalThis as any).window.fetch.mockClear()

        insights.resetPersonPropertiesForFlags()

        await waitForExpect(200, () => {
          expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/flags/'),
            expect.any(Object)
          )
        })
      })

      it('should not reload feature flags when reloadFeatureFlags is false for resetPersonPropertiesForFlags', async () => {
        insights.setPersonPropertiesForFlags({ email: 'test@example.com' }, false)
        ;(globalThis as any).window.fetch.mockClear()

        insights.resetPersonPropertiesForFlags(false)

        await new Promise((resolve) => setTimeout(resolve, 100))

        expect((globalThis as any).window.fetch).not.toHaveBeenCalled()
      })

      it('should reload feature flags by default when calling setPersonProperties', async () => {
        insights.setPersonProperties({ email: 'test@example.com' })

        await waitForExpect(200, () => {
          expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/flags/'),
            expect.any(Object)
          )
        })
      })

      it('should not reload feature flags when reloadFeatureFlags is false for setPersonProperties', async () => {
        // Clear any previous calls
        ;(globalThis as any).window.fetch.mockClear()

        insights.setPersonProperties({ email: 'test@example.com' }, undefined, false)

        // Wait for any async operations
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Should have the batch call for $set event, but not a flags call
        const allCalls = (globalThis as any).window.fetch.mock.calls
        const flagsCalls = allCalls.filter((call: any) => call[0].includes('/flags/'))
        expect(flagsCalls.length).toBe(0)
      })

      it('should reload feature flags by default when calling resetGroupPropertiesForFlags', async () => {
        insights.setGroupPropertiesForFlags({ company: { name: 'Acme Inc' } }, false)
        ;(globalThis as any).window.fetch.mockClear()

        insights.resetGroupPropertiesForFlags()

        await waitForExpect(200, () => {
          expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/flags/'),
            expect.any(Object)
          )
        })
      })

      it('should not reload feature flags when reloadFeatureFlags is false for resetGroupPropertiesForFlags', async () => {
        insights.setGroupPropertiesForFlags({ company: { name: 'Acme Inc' } }, false)
        ;(globalThis as any).window.fetch.mockClear()

        insights.resetGroupPropertiesForFlags(false)

        await new Promise((resolve) => setTimeout(resolve, 100))

        expect((globalThis as any).window.fetch).not.toHaveBeenCalled()
      })
    })

    describe('reset with propertiesToKeep', () => {
      let storage: InsightsCustomStorage
      let cache: Record<string, string>

      beforeEach(async () => {
        cache = {}
        storage = {
          getItem: jest.fn((key: string) => cache[key]),
          setItem: jest.fn((key: string, value: string) => {
            cache[key] = value
          }),
        }
      })

      it('should preserve specified properties when reset is called with propertiesToKeep', async () => {
        insights = new Insights('test-api-key', {
          customStorage: storage,
          flushInterval: 0,
          setDefaultPersonProperties: false,
        })
        await insights.ready()

        insights.overrideFeatureFlag({ testFlag: true })
        insights.register({ customProp: 'value' })

        expect(insights.getPersistedProperty(InsightsPersistedProperty.OverrideFeatureFlags)).toEqual({ testFlag: true })
        expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual({ customProp: 'value' })

        insights.reset([InsightsPersistedProperty.OverrideFeatureFlags])

        expect(insights.getPersistedProperty(InsightsPersistedProperty.OverrideFeatureFlags)).toEqual({ testFlag: true })
        expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual(undefined)
      })

      it('should clear all properties when reset is called without propertiesToKeep', async () => {
        insights = new Insights('test-api-key', {
          customStorage: storage,
          flushInterval: 0,
          setDefaultPersonProperties: false,
        })
        await insights.ready()

        insights.overrideFeatureFlag({ testFlag: true })
        insights.register({ customProp: 'value' })

        expect(insights.getPersistedProperty(InsightsPersistedProperty.OverrideFeatureFlags)).toEqual({ testFlag: true })
        expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual({ customProp: 'value' })

        insights.reset()

        expect(insights.getPersistedProperty(InsightsPersistedProperty.OverrideFeatureFlags)).toEqual(undefined)
        expect(insights.getPersistedProperty(InsightsPersistedProperty.Props)).toEqual(undefined)
      })
    })
  })
})

describe('Feature flag error tracking', () => {
  let insights: Insights

  beforeEach(() => {
    ;(globalThis as any).window.fetch = jest.fn()
    insights = new Insights('test-api-key', {
      flushAt: 1,
      host: 'https://app.insights.com',
      fetchRetryCount: 0,
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: true,
    })
  })

  afterEach(async () => {
    ;(globalThis as any).window.fetch = undefined
    insights.setPersistedProperty(InsightsPersistedProperty.FeatureFlagDetails, null)
    insights.setPersistedProperty(InsightsPersistedProperty.FlagsEndpointWasHit, null)
    await insights.shutdown()
  })

  it('should set $feature_flag_error to flag_missing when flag is not in response', async () => {
    ;(globalThis as any).window.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/flags/')) {
        return Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({
              flags: {
                'other-flag': {
                  key: 'other-flag',
                  enabled: true,
                  variant: undefined,
                  reason: undefined,
                  metadata: { id: 1, version: 1, payload: undefined, description: undefined },
                },
              },
              errorsWhileComputingFlags: false,
              requestId: 'test-request-id',
              evaluatedAt: Date.now(),
            }),
        })
      }
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ status: 'ok' }) })
    })

    await insights.reloadFeatureFlagsAsync()

    // Access a non-existent flag
    insights.getFeatureFlag('non-existent-flag')

    await waitForExpect(500, () => {
      const calls = ((globalThis as any).window.fetch as jest.Mock).mock.calls
      const captureCall = calls.find((call: any[]) => call[0].includes('/batch'))
      expect(captureCall).toBeDefined()
      const body = JSON.parse(captureCall[1].body)
      const featureFlagEvent = body.batch.find((e: any) => e.event === '$feature_flag_called')
      expect(featureFlagEvent).toBeDefined()
      expect(featureFlagEvent.properties.$feature_flag_error).toBe(FeatureFlagError.FLAG_MISSING)
    })
  })

  it('should set $feature_flag_error to errors_while_computing_flags when server returns that flag', async () => {
    ;(globalThis as any).window.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/flags/')) {
        return Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({
              flags: {
                'some-flag': {
                  key: 'some-flag',
                  enabled: true,
                  variant: undefined,
                  reason: undefined,
                  metadata: { id: 1, version: 1, payload: undefined, description: undefined },
                },
              },
              errorsWhileComputingFlags: true,
              requestId: 'test-request-id',
              evaluatedAt: Date.now(),
            }),
        })
      }
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ status: 'ok' }) })
    })

    await insights.reloadFeatureFlagsAsync()

    // Access the flag that exists
    insights.getFeatureFlag('some-flag')

    await waitForExpect(500, () => {
      const calls = ((globalThis as any).window.fetch as jest.Mock).mock.calls
      const captureCall = calls.find((call: any[]) => call[0].includes('/batch'))
      expect(captureCall).toBeDefined()
      const body = JSON.parse(captureCall[1].body)
      const featureFlagEvent = body.batch.find((e: any) => e.event === '$feature_flag_called')
      expect(featureFlagEvent).toBeDefined()
      expect(featureFlagEvent.properties.$feature_flag_error).toBe(FeatureFlagError.ERRORS_WHILE_COMPUTING)
    })
  })

  it('should set $feature_flag_error to quota_limited when quota limited', async () => {
    ;(globalThis as any).window.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/flags/')) {
        return Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({
              flags: {},
              errorsWhileComputingFlags: false,
              quotaLimited: ['feature_flags'],
              requestId: 'test-request-id',
              evaluatedAt: Date.now(),
            }),
        })
      }
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ status: 'ok' }) })
    })

    await insights.reloadFeatureFlagsAsync()

    // Access any flag when quota limited (no cached flags exist)
    const result = insights.getFeatureFlag('any-flag')
    expect(result).toBeUndefined()

    await waitForExpect(500, () => {
      const calls = ((globalThis as any).window.fetch as jest.Mock).mock.calls
      const captureCall = calls.find((call: any[]) => call[0].includes('/batch'))
      expect(captureCall).toBeDefined()
      const body = JSON.parse(captureCall[1].body)
      const featureFlagEvent = body.batch.find((e: any) => e.event === '$feature_flag_called')
      expect(featureFlagEvent).toBeDefined()
      // FLAG_MISSING is not tracked when quota limited since we cannot determine if the flag is truly missing
      expect(featureFlagEvent.properties.$feature_flag_error).toBe(FeatureFlagError.QUOTA_LIMITED)
    })
  })

  it('should set $feature_flag_error to api_error_500 when request fails with 500', async () => {
    // First, let the initial setup succeed
    ;(globalThis as any).window.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/flags/')) {
        return Promise.resolve({
          status: 500,
          json: () => Promise.reject(new Error('Server error')),
        })
      }
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ status: 'ok' }) })
    })

    await insights.reloadFeatureFlagsAsync()

    // Access a flag when request failed
    insights.getFeatureFlag('any-flag')

    await waitForExpect(500, () => {
      const calls = ((globalThis as any).window.fetch as jest.Mock).mock.calls
      const captureCall = calls.find((call: any[]) => call[0].includes('/batch'))
      expect(captureCall).toBeDefined()
      const body = JSON.parse(captureCall[1].body)
      const featureFlagEvent = body.batch.find((e: any) => e.event === '$feature_flag_called')
      expect(featureFlagEvent).toBeDefined()
      expect(featureFlagEvent.properties.$feature_flag_error).toBe(FeatureFlagError.apiError(500))
    })
  })

  it('should join multiple errors with commas', async () => {
    ;(globalThis as any).window.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/flags/')) {
        return Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({
              flags: {},
              errorsWhileComputingFlags: true,
              requestId: 'test-request-id',
              evaluatedAt: Date.now(),
            }),
        })
      }
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ status: 'ok' }) })
    })

    await insights.reloadFeatureFlagsAsync()

    // Access a non-existent flag when errors while computing
    insights.getFeatureFlag('missing-flag')

    await waitForExpect(500, () => {
      const calls = ((globalThis as any).window.fetch as jest.Mock).mock.calls
      const captureCall = calls.find((call: any[]) => call[0].includes('/batch'))
      expect(captureCall).toBeDefined()
      const body = JSON.parse(captureCall[1].body)
      const featureFlagEvent = body.batch.find((e: any) => e.event === '$feature_flag_called')
      expect(featureFlagEvent).toBeDefined()
      expect(featureFlagEvent.properties.$feature_flag_error).toBe(
        `${FeatureFlagError.ERRORS_WHILE_COMPUTING},${FeatureFlagError.FLAG_MISSING}`
      )
    })
  })

  it('should not set $feature_flag_error when flag is found successfully', async () => {
    ;(globalThis as any).window.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/flags/')) {
        return Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({
              flags: {
                'my-flag': {
                  key: 'my-flag',
                  enabled: true,
                  variant: undefined,
                  reason: undefined,
                  metadata: { id: 1, version: 1, payload: undefined, description: undefined },
                },
              },
              errorsWhileComputingFlags: false,
              requestId: 'test-request-id',
              evaluatedAt: Date.now(),
            }),
        })
      }
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ status: 'ok' }) })
    })

    await insights.reloadFeatureFlagsAsync()

    // Access the existing flag
    const result = insights.getFeatureFlag('my-flag')
    expect(result).toBe(true)

    await waitForExpect(500, () => {
      const calls = ((globalThis as any).window.fetch as jest.Mock).mock.calls
      const captureCall = calls.find((call: any[]) => call[0].includes('/batch'))
      expect(captureCall).toBeDefined()
      const body = JSON.parse(captureCall[1].body)
      const featureFlagEvent = body.batch.find((e: any) => e.event === '$feature_flag_called')
      expect(featureFlagEvent).toBeDefined()
      // $feature_flag_error should not be present
      expect(featureFlagEvent.properties.$feature_flag_error).toBeUndefined()
    })
  })
})
