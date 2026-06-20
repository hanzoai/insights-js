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

  it.each([
    ['missing', undefined as unknown as string],
    ['empty', ''],
    ['blank', '   '],
  ])('should initialize disabled instead of throwing when the api key is %s', async (_case, apiKey) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      insights = new Insights(apiKey, {
        persistence: 'memory',
        flushInterval: 0,
      })

      await insights.ready()

      expect(insights.isDisabled).toEqual(true)

      insights.reloadFeatureFlags()
      await insights.reloadFeatureFlagsAsync()
      await insights.reloadRemoteConfigAsync()
      await insights.getSurveysStateless()

      insights.setPersistedProperty(InsightsPersistedProperty.Queue, [{ message: { event: 'queued' } }] as any)
      insights.setPersistedProperty(InsightsPersistedProperty.LogsQueue, [{ record: { body: 'queued' } }] as any)
      insights.capture('event')
      insights.captureLog({ body: 'log' })
      await insights.flush()
      await insights.flushLogs()

      expect((globalThis as any).window.fetch).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "You must pass your Insights project's api key. The client will be disabled."
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
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
      $is_emulator: false,
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
      // The first instance's app-version write is debounced; drain it so the
      // second instance reads it on preload and detects an update (not a fresh
      // install).
      await (insights as any)._eventsStorage.waitForPersist()
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

    it('drains debounced storage writes on shutdown', async () => {
      insights = new Insights('1', {
        customStorage: storage,
        captureAppLifecycleEvents: false,
      })
      ;(storage.setItem as jest.Mock).mockClear()

      insights.setPersistedProperty(InsightsPersistedProperty.DistinctId, 'persisted-on-shutdown')
      // Debounced — nothing written to the backend yet.
      expect(storage.setItem).not.toHaveBeenCalled()

      await insights.shutdown()

      // _shutdown drains pending writes, so the value reaches the backend even
      // though no flush/background transition forced it.
      const written = (storage.setItem as jest.Mock).mock.calls
        .map((call) => JSON.parse(call[1] as string))
        .find((blob) => blob.content[InsightsPersistedProperty.DistinctId] === 'persisted-on-shutdown')
      expect(written).toBeDefined()
    })

    it('drains debounced storage writes when the app backgrounds', () => {
      ;(AppState.addEventListener as jest.Mock).mockClear()
      insights = new Insights('1', {
        customStorage: storage,
        captureAppLifecycleEvents: false,
      })
      // With captureAppLifecycleEvents off, the constructor registers exactly
      // one AppState listener (the lifecycle one is gated on that flag).
      const onAppStateChange = (AppState.addEventListener as jest.Mock).mock.calls[0][1]

      ;(storage.setItem as jest.Mock).mockClear()
      insights.setPersistedProperty(InsightsPersistedProperty.DistinctId, 'persisted-on-background')
      // Debounced — nothing on disk yet.
      expect(storage.setItem).not.toHaveBeenCalled()

      // Backgrounding must drain to disk synchronously before the OS suspends us.
      onAppStateChange('background')

      expect(storage.setItem).toHaveBeenCalled()
      const written = JSON.parse((storage.setItem as jest.Mock).mock.calls.at(-1)![1] as string)
      expect(written.content[InsightsPersistedProperty.DistinctId]).toEqual('persisted-on-background')
    })

    it('persists reset() to disk synchronously so logout cannot leak across sessions', async () => {
      insights = new Insights('1', {
        customStorage: storage,
        captureAppLifecycleEvents: false,
      })
      insights.setPersistedProperty(InsightsPersistedProperty.DistinctId, 'previous-user')
      await (insights as any)._eventsStorage.waitForPersist()

      // Sanity: the previous user is on disk.
      let written = JSON.parse((storage.setItem as jest.Mock).mock.calls.at(-1)![1] as string)
      expect(written.content[InsightsPersistedProperty.DistinctId]).toEqual('previous-user')
      ;(storage.setItem as jest.Mock).mockClear()

      // Logout. The clear must reach disk synchronously (drained), NOT wait out
      // the debounce — otherwise a crash in the window would resurface the
      // previous user's identity on next launch.
      insights.reset()

      expect(storage.setItem).toHaveBeenCalled()
      written = JSON.parse((storage.setItem as jest.Mock).mock.calls.at(-1)![1] as string)
      expect(written.content[InsightsPersistedProperty.DistinctId]).toBeUndefined()
    })

    it('persists identify() to disk synchronously (account-switch safety)', async () => {
      insights = new Insights('1', {
        customStorage: storage,
        captureAppLifecycleEvents: false,
      })
      insights.identify('user-a')
      await (insights as any)._eventsStorage.waitForPersist()
      ;(storage.setItem as jest.Mock).mockClear()

      // Switch accounts. The new identity must reach disk synchronously, not on
      // the debounce — a crash in the window must not leave user-a on disk.
      insights.identify('user-b')

      expect(storage.setItem).toHaveBeenCalled()
      const written = JSON.parse((storage.setItem as jest.Mock).mock.calls.at(-1)![1] as string)
      expect(written.content[InsightsPersistedProperty.DistinctId]).toEqual('user-b')
    })

    it('flushes both pipelines to disk synchronously on a fatal exception', () => {
      insights = new Insights('1', {
        customStorage: storage,
        captureAppLifecycleEvents: false,
      })
      // Seed a log so the logs pipeline has something to flush.
      insights.setPersistedProperty(InsightsPersistedProperty.LogsQueue, [{ message: 'log' }])
      ;(storage.setItem as jest.Mock).mockClear()

      insights.captureException(new Error('boom'), { $exception_level: 'fatal' })

      // A fatal exception can crash the app within the debounce window, so both
      // pipelines reach disk synchronously: the events file (holding the
      // exception) and the logs file.
      const writes = (storage.setItem as jest.Mock).mock.calls
      const wroteLogs = writes.some((c) => String(c[0]).includes('logs'))
      const eventsWrite = writes.find((c) => !String(c[0]).includes('logs'))
      expect(wroteLogs).toBe(true)
      expect(eventsWrite).toBeDefined()
      // Assert on the parsed queue, not a substring — the actual exception event
      // must be in the persisted queue, not just the $exception_level tag.
      const queue =
        (JSON.parse(eventsWrite![1] as string).content[InsightsPersistedProperty.Queue] as Array<{
          message?: { event?: string }
        }>) ?? []
      expect(queue.some((item) => item.message?.event === '$exception')).toBe(true)
    })

    it('does not flush synchronously on a non-fatal exception (uses the debounce)', () => {
      insights = new Insights('1', {
        customStorage: storage,
        captureAppLifecycleEvents: false,
      })
      ;(storage.setItem as jest.Mock).mockClear()

      insights.captureException(new Error('boom'))

      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('persists optOut() to disk synchronously (consent durability)', () => {
      insights = new Insights('1', {
        customStorage: storage,
        captureAppLifecycleEvents: false,
      })
      ;(storage.setItem as jest.Mock).mockClear()

      insights.optOut()

      // A hard kill within the debounce window must not lose the opt-out and
      // resurface as "capture allowed" on next launch.
      expect(storage.setItem).toHaveBeenCalled()
      const written = JSON.parse((storage.setItem as jest.Mock).mock.calls.at(-1)![1] as string)
      expect(written.content[InsightsPersistedProperty.OptedOut]).toBe(true)
    })

    it('persists optIn() to disk synchronously (consent durability)', () => {
      insights = new Insights('1', {
        customStorage: storage,
        captureAppLifecycleEvents: false,
      })
      ;(storage.setItem as jest.Mock).mockClear()

      insights.optIn()

      expect(storage.setItem).toHaveBeenCalled()
      const written = JSON.parse((storage.setItem as jest.Mock).mock.calls.at(-1)![1] as string)
      expect(written.content[InsightsPersistedProperty.OptedOut]).toBe(false)
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
        captureAppLifecycleEvents: false,
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
        captureAppLifecycleEvents: false,
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

      it.each(typePreservationCases)(
        'preserves $name in group properties (no String() coercion)',
        ({ value, buggyString }) => {
          insights.group('company', 'acme-inc', { prop: value })

          const cachedProps = insights.getPersistedProperty<Record<string, Record<string, JsonType>>>(
            InsightsPersistedProperty.GroupProperties
          )
          expect(cachedProps?.company.prop).toEqual(value)
          expect(cachedProps?.company.prop).not.toBe(buggyString)
        }
      )

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

  describe('device bucketing', () => {
    it('should initialize device_id on first init', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })

      await insights.ready()

      const deviceId = insights.getDeviceId()
      expect(deviceId).toBeTruthy()
      expect(deviceId).toEqual(insights.getAnonymousId())
    })

    it('should persist device_id across SDK restarts', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      const originalDeviceId = insights.getDeviceId()
      await insights.shutdown()

      // Re-init with same storage
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      expect(insights.getDeviceId()).toEqual(originalDeviceId)
    })

    it('should preserve device_id across identify()', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      const originalDeviceId = insights.getDeviceId()
      insights.identify('user-123')

      expect(insights.getDeviceId()).toEqual(originalDeviceId)
      expect(insights.getDistinctId()).toEqual('user-123')
    })

    it('should preserve device_id across reset()', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      const originalDeviceId = insights.getDeviceId()
      insights.identify('user-123')
      insights.reset()

      expect(insights.getDeviceId()).toEqual(originalDeviceId)
      // distinct_id should have changed
      expect(insights.getDistinctId()).not.toEqual('user-123')
    })

    it('should regenerate device_id when reset is called with explicit propertiesToKeep omitting DeviceId', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      const originalDeviceId = insights.getDeviceId()
      // Passing an explicit list without DeviceId causes it to be cleared
      insights.reset([])

      await waitForExpect(200, () => {
        const newDeviceId = insights.getDeviceId()
        expect(newDeviceId).toBeTruthy()
        expect(newDeviceId).not.toEqual(originalDeviceId)
      })
    })

    it('should send $device_id in feature flag requests', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      const deviceId = insights.getDeviceId()
      await insights.reloadFeatureFlagsAsync()

      expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/flags/'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(`"$device_id":"${deviceId}"`),
        })
      )
    })

    it('should send the same $device_id after identify()', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      const deviceId = insights.getDeviceId()
      insights.identify('user-123')
      await insights.reloadFeatureFlagsAsync()

      expect((globalThis as any).window.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/flags/'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(`"$device_id":"${deviceId}"`),
        })
      )
    })

    it('should lazy-init device_id for upgrades via getDeviceId()', async () => {
      // Simulate an upgrade: existing install has anonymous_id persisted but no device_id.
      // InsightsRNStorage stores all properties in a single JSON blob under '.insights-rn.json'.
      const upgradeData = JSON.stringify({
        version: 'v1',
        content: { [InsightsPersistedProperty.AnonymousId]: 'existing-anon-id' },
      })
      cache['.insights-rn.json'] = upgradeData

      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      // device_id should be set to the existing anonymous_id during initAfterStorage
      expect(insights.getDeviceId()).toEqual('existing-anon-id')
      expect(insights.getAnonymousId()).toEqual('existing-anon-id')
    })
  })

  // Hybrid storage routing: `InsightsPersistedProperty.LogsQueue` routes to
  // a dedicated `_logsStorage` instance backed by `.insights-rn-logs.json`,
  // while every other enum key stays in `_eventsStorage` backed by
  // `.insights-rn.json`. These tests lock in the routing invariants.
  describe('logs storage routing', () => {
    it('routes LogsQueue to _logsStorage and other keys to _eventsStorage (bidirectional)', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      insights.setPersistedProperty(InsightsPersistedProperty.Queue, ['event1'])
      insights.setPersistedProperty(InsightsPersistedProperty.LogsQueue, ['log1'])

      // Reads via the instance API
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Queue)).toEqual(['event1'])
      expect(insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue)).toEqual(['log1'])

      // Verify each value landed in its expected storage's memoryCache
      const eventsMemoryCache = (insights as any)._eventsStorage.memoryCache
      const logsMemoryCache = (insights as any)._logsStorage.memoryCache

      expect(eventsMemoryCache[InsightsPersistedProperty.Queue]).toEqual(['event1'])
      expect(logsMemoryCache[InsightsPersistedProperty.LogsQueue]).toEqual(['log1'])

      // Cross-contamination check
      expect(eventsMemoryCache[InsightsPersistedProperty.LogsQueue]).toBeUndefined()
      expect(logsMemoryCache[InsightsPersistedProperty.Queue]).toBeUndefined()
    })

    it('routes non-LogsQueue keys to _eventsStorage, not _logsStorage', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      insights.setPersistedProperty(InsightsPersistedProperty.DistinctId, 'user-abc')
      insights.setPersistedProperty(InsightsPersistedProperty.SessionId, 'sess-xyz')

      const eventsMemoryCache = (insights as any)._eventsStorage.memoryCache
      const logsMemoryCache = (insights as any)._logsStorage.memoryCache

      // Non-queue keys land in events storage
      expect(eventsMemoryCache[InsightsPersistedProperty.DistinctId]).toBe('user-abc')
      expect(eventsMemoryCache[InsightsPersistedProperty.SessionId]).toBe('sess-xyz')

      // Logs storage stays untouched by non-logs keys
      expect(logsMemoryCache[InsightsPersistedProperty.DistinctId]).toBeUndefined()
      expect(logsMemoryCache[InsightsPersistedProperty.SessionId]).toBeUndefined()
    })

    it('writes LogsQueue to .insights-rn-logs.json and not to .insights-rn.json', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      insights.setPersistedProperty(InsightsPersistedProperty.LogsQueue, [{ record: { body: { stringValue: 'test' } } }])

      // Let async persist complete on the logs storage
      await (insights as any)._logsStorage.waitForPersist()

      const logsFile = cache['.insights-rn-logs.json']
      const mainFile = cache['.insights-rn.json']

      expect(logsFile).toBeDefined()
      const logsParsed = JSON.parse(logsFile)
      expect(logsParsed.content[InsightsPersistedProperty.LogsQueue]).toHaveLength(1)
      expect(logsParsed.content[InsightsPersistedProperty.LogsQueue][0].record.body.stringValue).toBe('test')

      // Main file should not contain the logs queue — either the key isn't there
      // or the main file wasn't written at all (depends on whether init wrote anything else)
      if (mainFile) {
        const mainParsed = JSON.parse(mainFile)
        expect(mainParsed.content[InsightsPersistedProperty.LogsQueue]).toBeUndefined()
      }
    })

    it('reset() preserves both Queue and LogsQueue', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      insights.setPersistedProperty(InsightsPersistedProperty.Queue, ['event1'])
      insights.setPersistedProperty(InsightsPersistedProperty.LogsQueue, ['log1'])
      // Also set something that SHOULD be cleared by reset
      insights.setPersistedProperty(InsightsPersistedProperty.DistinctId, 'user-123')

      insights.reset()

      // In-flight events and logs survive reset
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Queue)).toEqual(['event1'])
      expect(insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue)).toEqual(['log1'])
      // Regular state is cleared
      expect(insights.getPersistedProperty(InsightsPersistedProperty.DistinctId)).toBeUndefined()
    })

    it('setPersistedProperty(LogsQueue, null) removes from logs storage, not main storage', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      insights.setPersistedProperty(InsightsPersistedProperty.LogsQueue, ['log1'])
      insights.setPersistedProperty(InsightsPersistedProperty.DistinctId, 'user-123')

      // Null routes to removeItem on the correct storage
      insights.setPersistedProperty(InsightsPersistedProperty.LogsQueue, null)

      expect(insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue)).toBeUndefined()
      // DistinctId in main storage is untouched
      expect(insights.getPersistedProperty(InsightsPersistedProperty.DistinctId)).toBe('user-123')
    })

    // End-to-end: real Insights instance → real _logs module → real routing → real storage.
    // Unit tests use a mock instance; routing tests don't use _logs. This covers the seam.
    it('captureLog via _logs module lands in logs storage through real routing', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      // Ensure logs storage preload completes before calling captureLog so
      // the capture goes through the direct read-mutate-write path, not the
      // pending-buffer path (which is tested separately in logs.spec.ts).
      await (insights as any)._logsStorage.preloadPromise
      ;(insights as any)._logs.captureLog({ body: 'hello' })

      const logsQueue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as
        | Array<{ record: { body: { stringValue: string } } }>
        | undefined
      expect(logsQueue).toHaveLength(1)
      expect(logsQueue?.[0].record.body.stringValue).toBe('hello')

      // Main storage's events queue should be untouched by captureLog
      expect(insights.getPersistedProperty(InsightsPersistedProperty.Queue)).toBeUndefined()
    })

    it('AppState change drains both events and logs pipelines in parallel', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      const flushSpy = jest.spyOn(insights, 'flush').mockResolvedValue(undefined)
      const logsFlushSpy = jest.spyOn((insights as any)._logs, 'flush').mockResolvedValue(undefined)
      const waitForPersistSpy = jest
        .spyOn((insights as any)._logsStorage, 'waitForPersist')
        .mockResolvedValue(undefined as never)

      // AppState.addEventListener is globally mocked; grab the callback that
      // was passed to it during Insights construction and invoke it manually.
      const calls = (AppState.addEventListener as jest.Mock).mock.calls
      const changeCall = calls.find((c) => c[0] === 'change')
      expect(changeCall).toBeDefined()
      const callback = changeCall![1]

      callback('background' as AppStateStatus)

      expect(flushSpy).toHaveBeenCalled()
      expect(logsFlushSpy).toHaveBeenCalled()
      expect(waitForPersistSpy).toHaveBeenCalled()

      flushSpy.mockRestore()
      logsFlushSpy.mockRestore()
      waitForPersistSpy.mockRestore()
    })

    it('AppState surfaces a failing logs flush via logFlushError (console visibility)', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      // Suppress console.error noise from the assertion itself; the spy still
      // records the call for verification.
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      jest.spyOn(insights, 'flush').mockResolvedValue(undefined)
      jest.spyOn((insights as any)._logs, 'flush').mockRejectedValue(new Error('logs transport down'))

      const calls = (AppState.addEventListener as jest.Mock).mock.calls
      const callback = calls.find((c) => c[0] === 'change')![1]
      callback('background' as AppStateStatus)

      // Let the catch + awaited logFlushError microtask resolve.
      await new Promise((r) => setImmediate(r))

      // logFlushError writes to console.error — matches the events pipeline
      // so a silent transport failure is still visible in the app's logs.
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('captureLog → flush() posts OTLP payload to /i/v1/logs via _sendLogsBatch', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      const sendSpy = jest.spyOn(insights as any, '_sendLogsBatch').mockResolvedValue({ kind: 'ok' } as never)

      ;(insights as any)._logs.captureLog({ body: 'integration-test' })
      await (insights as any)._logs.flush()

      expect(sendSpy).toHaveBeenCalledTimes(1)
      const payload = sendSpy.mock.calls[0][0] as any
      const bodies = payload.resourceLogs[0].scopeLogs[0].logRecords.map((r: any) => r.body.stringValue)
      expect(bodies).toEqual(['integration-test'])
      // Successful send should drain the queue.
      expect(insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue)).toEqual([])

      sendSpy.mockRestore()
    })

    it('shutdown() drains both events and logs and clears the logs flush timer', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      const logsShutdownSpy = jest.spyOn((insights as any)._logs, 'shutdown')
      const sendLogsSpy = jest.spyOn(insights as any, '_sendLogsBatch').mockResolvedValue({ kind: 'ok' } as never)

      // Queue a log and fire a single capture so both pipelines have work.
      ;(insights as any)._logs.captureLog({ body: 'terminal' })
      insights.capture('terminal-event', {})

      await insights.shutdown(5000)

      // Both pipelines drained through the shared shutdown path. Logs use
      // the smaller of the caller's shutdown budget and the configured
      // `terminationFlushBudgetMs` (default 2000ms) — see _shutdown.
      expect(logsShutdownSpy).toHaveBeenCalledWith(2000)
      expect(sendLogsSpy).toHaveBeenCalled()

      logsShutdownSpy.mockRestore()
      sendLogsSpy.mockRestore()
    })

    it('pre-init captureLog is drained on flush once init completes', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })

      // Capture BEFORE ready() resolves — this exercises the wrap()/onReady
      // init-gating path: the enqueue defers until _initPromise resolves.
      ;(insights as any)._logs.captureLog({ body: 'pre-init' })

      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      const sendSpy = jest.spyOn(insights as any, '_sendLogsBatch').mockResolvedValue({ kind: 'ok' } as never)

      await (insights as any)._logs.flush()

      expect(sendSpy).toHaveBeenCalledTimes(1)
      const bodies = (sendSpy.mock.calls[0][0] as any).resourceLogs[0].scopeLogs[0].logRecords.map(
        (r: any) => r.body.stringValue
      )
      expect(bodies).toEqual(['pre-init'])

      sendSpy.mockRestore()
    })

    // Public API — user-facing surface on Insights: `captureLog` + `logger` +
    // `options.logs`. These tests verify the seam that replaced the internal
    // `_logs.captureLog` reach-ins above.
    it('insights.captureLog() delegates to the internal logs module', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      insights.captureLog({ body: 'public-api', level: 'warn', attributes: { foo: 'bar' } })

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      expect(queue).toHaveLength(1)
      expect(queue[0].record.body.stringValue).toBe('public-api')
      expect(queue[0].record.severityText).toBe('WARN')
      const attrs = Object.fromEntries(queue[0].record.attributes.map((a: any) => [a.key, a.value]))
      expect(attrs['foo']).toEqual({ stringValue: 'bar' })
    })

    it('insights.logger maps each method to the correct severity level', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      insights.logger.trace('t')
      insights.logger.debug('d')
      insights.logger.info('i')
      insights.logger.warn('w')
      insights.logger.error('e')
      insights.logger.fatal('f')

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      expect(queue).toHaveLength(6)
      expect(queue.map((e) => e.record.severityText)).toEqual(['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'])
    })

    it('insights.logger returns the same instance on repeated access (lazy + memoized)', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()

      expect(insights.logger).toBe(insights.logger)
    })

    it('options.logs.beforeSend is honored through the public captureLog path', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
        logs: {
          beforeSend: (r) => (r.body.includes('secret') ? null : { ...r, body: `${r.body}!` }),
        },
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      insights.captureLog({ body: 'hello' })
      insights.captureLog({ body: 'this has secret info' }) // dropped
      insights.captureLog({ body: 'world' })

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      expect(queue).toHaveLength(2)
      expect(queue.map((e) => e.record.body.stringValue)).toEqual(['hello!', 'world!'])
    })

    it('options.logs.maxLogsPerInterval enforces the rate cap end-to-end', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
        logs: { rateCap: { maxLogs: 3, windowMs: 10000 } },
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      for (let i = 0; i < 10; i++) {
        insights.captureLog({ body: `msg-${i}` })
      }

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      expect(queue).toHaveLength(3)
    })

    it('insights.flushLogs() drains the logs queue (and only the logs queue)', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      const sendLogsSpy = jest.spyOn(insights as any, '_sendLogsBatch').mockResolvedValue({ kind: 'ok' } as never)

      insights.captureLog({ body: 'manual-flush-target' })
      await insights.flushLogs()

      expect(sendLogsSpy).toHaveBeenCalledTimes(1)
      const bodies = (sendLogsSpy.mock.calls[0][0] as any).resourceLogs[0].scopeLogs[0].logRecords.map(
        (r: any) => r.body.stringValue
      )
      expect(bodies).toEqual(['manual-flush-target'])
      expect(insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue)).toEqual([])

      sendLogsSpy.mockRestore()
    })

    it('flush emits os.* and telemetry.sdk.* resource attrs', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      const sendSpy = jest.spyOn(insights as any, '_sendLogsBatch').mockResolvedValue({ kind: 'ok' } as never)

      insights.captureLog({ body: 'platform-tagged' })
      await insights.flushLogs()

      const resourceAttrs = Object.fromEntries(
        (sendSpy.mock.calls[0][0] as any).resourceLogs[0].resource.attributes.map((a: any) => [a.key, a.value])
      )
      // The RN test harness reports a real Platform.OS — assert presence
      // and shape rather than a specific platform value.
      expect(resourceAttrs['os.name']).toBeDefined()
      expect(typeof resourceAttrs['os.name'].stringValue).toBe('string')
      expect(resourceAttrs['os.version']).toBeDefined()
      expect(typeof resourceAttrs['os.version'].stringValue).toBe('string')
      expect(resourceAttrs['telemetry.sdk.name']).toEqual({ stringValue: 'insights-react-native' })
      expect(resourceAttrs['telemetry.sdk.version']).toBeDefined()

      sendSpy.mockRestore()
    })

    it('user-supplied options.logs.resourceAttributes overrides os.* defaults', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
        logs: { resourceAttributes: { 'os.name': 'overridden-os' } },
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      const sendSpy = jest.spyOn(insights as any, '_sendLogsBatch').mockResolvedValue({ kind: 'ok' } as never)

      insights.captureLog({ body: 'overridden' })
      await insights.flushLogs()

      const resourceAttrs = Object.fromEntries(
        (sendSpy.mock.calls[0][0] as any).resourceLogs[0].resource.attributes.map((a: any) => [a.key, a.value])
      )
      expect(resourceAttrs['os.name']).toEqual({ stringValue: 'overridden-os' })
      // os.version still falls through from Platform — only the overridden
      // key is replaced.
      expect(resourceAttrs['os.version']).toBeDefined()

      sendSpy.mockRestore()
    })

    it('captureLog tags records with screen.name from insights.screen()', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      // insights.screen() registers $screen_name as a session-scoped property;
      // the logs context-builder reads it at capture time.
      await insights.screen('checkout')
      insights.captureLog({ body: 'on-checkout-screen' })

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      // insights.screen() emits a $screen event which goes to events queue.
      // The captureLog goes to logs queue. Find ours by body.
      const target = queue.find((e) => e.record.body.stringValue === 'on-checkout-screen')
      expect(target).toBeDefined()
      const attrs = Object.fromEntries(target!.record.attributes.map((a: any) => [a.key, a.value]))
      expect(attrs['screen.name']).toEqual({ stringValue: 'checkout' })
    })

    it('captureLog tags records with feature_flags from getFeatureFlags()', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      // Stub the flag store directly — `getFeatureFlags()` is the same
      // primitive logs reads at capture time.
      jest.spyOn(insights, 'getFeatureFlags').mockReturnValue({
        'new-checkout': true,
        'experiment-ab': 'variant-a',
      } as any)

      insights.captureLog({ body: 'flagged-capture' })

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      const target = queue.find((e) => e.record.body.stringValue === 'flagged-capture')
      const attrs = Object.fromEntries(target!.record.attributes.map((a: any) => [a.key, a.value]))
      // OTLP serializes a string[] as arrayValue with stringValue children.
      expect(attrs['feature_flags']).toEqual({
        arrayValue: {
          values: [{ stringValue: 'new-checkout' }, { stringValue: 'experiment-ab' }],
        },
      })
    })

    it('captureLog omits feature_flags when flags have not loaded yet (undefined state)', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      jest.spyOn(insights, 'getFeatureFlags').mockReturnValue(undefined)

      insights.captureLog({ body: 'no-flags' })

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      const target = queue.find((e) => e.record.body.stringValue === 'no-flags')
      const attrs = Object.fromEntries(target!.record.attributes.map((a: any) => [a.key, a.value]))
      // `undefined` flags → "we don't know yet" → attribute omitted.
      expect(attrs['feature_flags']).toBeUndefined()
    })

    it('captureLog omits feature_flags when flags loaded but none are active (empty state)', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      // Logs gates `[]` to save bytes — same as browser logs. Distinct from
      // events, which emit `$active_feature_flags: []` for back-compat (the
      // shared helper preserves the empty array; only the caller's gate
      // differs).
      jest.spyOn(insights, 'getFeatureFlags').mockReturnValue({} as any)

      insights.captureLog({ body: 'empty-flags' })

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      const target = queue.find((e) => e.record.body.stringValue === 'empty-flags')
      const attrs = Object.fromEntries(target!.record.attributes.map((a: any) => [a.key, a.value]))
      expect(attrs['feature_flags']).toBeUndefined()
    })

    it('captureLog tags records with app.state, flipping with AppState changes', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      // The harness mocks `AppState.addEventListener` but not
      // `AppState.currentState`, so the constructor's seed is undefined and
      // the first capture omits `app.state` (correct — we don't guess). Drive
      // explicit 'active' then 'background' transitions through the listener
      // to verify the foreground/background mapping end-to-end.
      const calls = (AppState.addEventListener as jest.Mock).mock.calls
      const callback = calls.find((c) => c[0] === 'change')![1]

      callback('active' as AppStateStatus)
      insights.captureLog({ body: 'fg' })

      callback('background' as AppStateStatus)
      insights.captureLog({ body: 'bg' })

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      const fg = queue.find((e) => e.record.body.stringValue === 'fg')
      const bg = queue.find((e) => e.record.body.stringValue === 'bg')
      const fgAttrs = Object.fromEntries(fg!.record.attributes.map((a: any) => [a.key, a.value]))
      const bgAttrs = Object.fromEntries(bg!.record.attributes.map((a: any) => [a.key, a.value]))
      expect(fgAttrs['app.state']).toEqual({ stringValue: 'foreground' })
      expect(bgAttrs['app.state']).toEqual({ stringValue: 'background' })
    })

    it('captures across identify/reset boundaries keep their capture-time identity', async () => {
      // InsightsLogs builds the OTLP record at capture time, so distinctId/sessionId are
      // baked into `attributes` synchronously. reset() preserves the LogsQueue
      // so a record captured by alice keeps alice's identity even after reset()
      // and a subsequent identify(bob).
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      insights.identify('alice')
      insights.captureLog({ body: 'A-as-alice' })

      insights.reset()
      insights.identify('bob')
      insights.captureLog({ body: 'B-as-bob' })

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      const recordA = queue.find((e) => e.record.body.stringValue === 'A-as-alice')!
      const recordB = queue.find((e) => e.record.body.stringValue === 'B-as-bob')!
      const attrsA = Object.fromEntries(recordA.record.attributes.map((a: any) => [a.key, a.value]))
      const attrsB = Object.fromEntries(recordB.record.attributes.map((a: any) => [a.key, a.value]))

      expect(attrsA['insightsDistinctId']).toEqual({ stringValue: 'alice' })
      expect(attrsB['insightsDistinctId']).toEqual({ stringValue: 'bob' })
      // Both records should still be present — reset() must NOT drop the queue.
      expect(queue).toHaveLength(2)
    })

    it('manual capture is unconditional — remote config cannot block it', async () => {
      insights = new Insights('test-token', {
        customStorage: mockStorage,
        captureAppLifecycleEvents: false,
        preloadFeatureFlags: false,
      })
      await insights.ready()
      await (insights as any)._logsStorage.preloadPromise

      insights.captureLog({ body: 'manual-1' })
      insights.logger.error('manual-2')

      const queue = insights.getPersistedProperty(InsightsPersistedProperty.LogsQueue) as any[]
      expect(queue).toHaveLength(2)
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
      captureAppLifecycleEvents: false,
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
