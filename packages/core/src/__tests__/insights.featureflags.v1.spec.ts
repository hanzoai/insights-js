import { InsightsPersistedProperty, InsightsV1FlagsResponse } from '@/types'
import { normalizeFlagsResponse } from '@/featureFlagUtils'
import {
  parseBody,
  waitForPromises,
  createTestClient,
  InsightsCoreTestClient,
  InsightsCoreTestClientMocks,
} from '@/testing'

describe('Insights Feature Flags v1', () => {
  let insights: InsightsCoreTestClient
  let mocks: InsightsCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01'))

  const createMockFeatureFlags = (): any => ({
    'feature-1': true,
    'feature-2': true,
    'feature-variant': 'variant',
    'json-payload': true,
  })

  const createMockFeatureFlagPayloads = (): any => ({
    'feature-1': JSON.stringify({
      color: 'blue',
    }),
    'feature-variant': JSON.stringify([5]),
    'json-payload': '{"a":"payload"}',
  })

  const errorAPIResponse = Promise.resolve({
    status: 400,
    text: () => Promise.resolve('error'),
    json: () =>
      Promise.resolve({
        status: 'error',
      }),
  })

  beforeEach(() => {
    ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
      _mocks.fetch.mockImplementation((url) => {
        if (url.includes('/flags/?v=2')) {
          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve('ok'),
            json: () =>
              Promise.resolve({
                featureFlags: createMockFeatureFlags(),
                featureFlagPayloads: createMockFeatureFlagPayloads(),
              }),
          })
        }

        return Promise.resolve({
          status: 200,
          text: () => Promise.resolve('ok'),
          json: () =>
            Promise.resolve({
              status: 'ok',
            }),
        })
      })
    })
  })

  describe('featureflags', () => {
    it('getFeatureFlags should return undefined if not loaded', () => {
      expect(insights.getFeatureFlags()).toEqual(undefined)
    })

    it('getFeatureFlagPayloads should return undefined if not loaded', () => {
      expect(insights.getFeatureFlagPayloads()).toEqual(undefined)
    })

    it('getFeatureFlag should return undefined if not loaded', () => {
      expect(insights.getFeatureFlag('my-flag')).toEqual(undefined)
      expect(insights.getFeatureFlag('feature-1')).toEqual(undefined)
    })

    it('getFeatureFlagPayload should return undefined if not loaded', () => {
      expect(insights.getFeatureFlagPayload('my-flag')).toEqual(undefined)
    })

    it('isFeatureEnabled should return undefined if not loaded', () => {
      expect(insights.isFeatureEnabled('my-flag')).toEqual(undefined)
      expect(insights.isFeatureEnabled('feature-1')).toEqual(undefined)
    })

    it('should load legacy persisted feature flags', () => {
      insights.setPersistedProperty(InsightsPersistedProperty.FeatureFlags, createMockFeatureFlags())
      expect(insights.getFeatureFlags()).toEqual(createMockFeatureFlags())
    })

    it('should queue only one pending reload when called multiple times during in-flight request', async () => {
      // Multiple calls during an in-flight request should:
      // 1. Not make multiple immediate calls
      // 2. Queue a pending reload that executes after the first completes
      expect(mocks.fetch).toHaveBeenCalledTimes(0)
      insights.reloadFeatureFlagsAsync()
      insights.reloadFeatureFlagsAsync()
      const flags = await insights.reloadFeatureFlagsAsync()
      await waitForPromises() // Wait for pending reload to complete
      // First call + one pending reload = 2 calls
      expect(mocks.fetch).toHaveBeenCalledTimes(2)
      expect(flags).toEqual(createMockFeatureFlags())
    })

    it('should emit featureflags event when flags are loaded', async () => {
      const receivedFlags: any[] = []
      const unsubscribe = insights.onFeatureFlags((flags) => {
        receivedFlags.push(flags)
      })

      await insights.reloadFeatureFlagsAsync()
      unsubscribe()

      expect(receivedFlags).toEqual([createMockFeatureFlags()])
    })

    describe('when loaded', () => {
      beforeEach(() => {
        // The core doesn't reload flags by default (this is handled differently by web and RN)
        insights.reloadFeatureFlags()
      })

      it('should return the value of a flag', async () => {
        expect(insights.getFeatureFlag('feature-1')).toEqual(true)
        expect(insights.getFeatureFlag('feature-variant')).toEqual('variant')
        expect(insights.getFeatureFlag('feature-missing')).toEqual(false)
      })

      it('should return payload of matched flags only', async () => {
        expect(insights.getFeatureFlagPayload('feature-variant')).toEqual([5])
        expect(insights.getFeatureFlagPayload('feature-1')).toEqual({
          color: 'blue',
        })

        expect(insights.getFeatureFlagPayload('feature-2')).toEqual(null)
      })

      describe('when errored out', () => {
        beforeEach(() => {
          ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
            _mocks.fetch.mockImplementation((url) => {
              if (url.includes('/flags/')) {
                return Promise.resolve({
                  status: 400,
                  text: () => Promise.resolve('ok'),
                  json: () =>
                    Promise.resolve({
                      error: 'went wrong',
                    }),
                })
              }

              return errorAPIResponse
            })
          })

          insights.reloadFeatureFlags()
        })

        it('should return undefined', async () => {
          expect(mocks.fetch).toHaveBeenCalledWith('https://us.i.insights.com/flags/?v=2', {
            body: JSON.stringify({
              token: 'TEST_API_KEY',
              distinct_id: insights.getDistinctId(),
              groups: {},
              person_properties: {},
              group_properties: {},
              $anon_distinct_id: insights.getAnonymousId(),
            }),
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'insights-core-tests',
            },
            signal: expect.anything(),
          })

          expect(insights.getFeatureFlag('feature-1')).toEqual(undefined)
          expect(insights.getFeatureFlag('feature-variant')).toEqual(undefined)
          expect(insights.getFeatureFlag('feature-missing')).toEqual(undefined)

          expect(insights.isFeatureEnabled('feature-1')).toEqual(undefined)
          expect(insights.isFeatureEnabled('feature-variant')).toEqual(undefined)
          expect(insights.isFeatureEnabled('feature-missing')).toEqual(undefined)

          // When errored out, we return cached values (which are empty in this case)
          expect(insights.getFeatureFlagPayloads()).toEqual({})
          expect(insights.getFeatureFlagPayload('feature-1')).toEqual(null)
        })
      })

      describe('when subsequent flags calls return partial results', () => {
        beforeEach(() => {
          ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
            _mocks.fetch
              .mockImplementationOnce((url) => {
                if (url.includes('/flags/?v=2')) {
                  return Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        featureFlags: createMockFeatureFlags(),
                      }),
                  })
                }
                return errorAPIResponse
              })
              .mockImplementationOnce((url) => {
                if (url.includes('/flags/?v=2')) {
                  return Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        featureFlags: { 'x-flag': 'x-value', 'feature-1': false },
                        errorsWhileComputingFlags: true,
                      }),
                  })
                }

                return errorAPIResponse
              })
              .mockImplementation(() => {
                return errorAPIResponse
              })
          })

          insights.reloadFeatureFlags()
        })

        it('should return combined results', async () => {
          expect(mocks.fetch).toHaveBeenCalledWith('https://us.i.insights.com/flags/?v=2', {
            body: JSON.stringify({
              token: 'TEST_API_KEY',
              distinct_id: insights.getDistinctId(),
              groups: {},
              person_properties: {},
              group_properties: {},
              $anon_distinct_id: insights.getAnonymousId(),
            }),
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'insights-core-tests',
            },
            signal: expect.anything(),
          })

          expect(insights.getFeatureFlags()).toEqual({
            'feature-1': true,
            'feature-2': true,
            'json-payload': true,
            'feature-variant': 'variant',
          })

          // now second call to feature flags
          await insights.reloadFeatureFlagsAsync()

          expect(mocks.fetch).toHaveBeenCalledWith('https://us.i.insights.com/flags/?v=2', {
            body: JSON.stringify({
              token: 'TEST_API_KEY',
              distinct_id: insights.getDistinctId(),
              groups: {},
              person_properties: {},
              group_properties: {},
              $anon_distinct_id: insights.getAnonymousId(),
            }),
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'insights-core-tests',
            },
            signal: expect.anything(),
          })

          expect(insights.getFeatureFlags()).toEqual({
            'feature-1': false,
            'feature-2': true,
            'json-payload': true,
            'feature-variant': 'variant',
            'x-flag': 'x-value',
          })

          expect(insights.getFeatureFlag('feature-1')).toEqual(false)
          expect(insights.getFeatureFlag('feature-variant')).toEqual('variant')
          expect(insights.getFeatureFlag('feature-missing')).toEqual(false)
          expect(insights.getFeatureFlag('x-flag')).toEqual('x-value')

          expect(insights.isFeatureEnabled('feature-1')).toEqual(false)
          expect(insights.isFeatureEnabled('feature-variant')).toEqual(true)
          expect(insights.isFeatureEnabled('feature-missing')).toEqual(false)
          expect(insights.isFeatureEnabled('x-flag')).toEqual(true)
        })
      })

      describe('when subsequent flags calls return results without errors', () => {
        beforeEach(() => {
          ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
            _mocks.fetch
              .mockImplementationOnce((url) => {
                if (url.includes('/flags/?v=2')) {
                  return Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        featureFlags: createMockFeatureFlags(),
                      }),
                  })
                }
                return errorAPIResponse
              })
              .mockImplementationOnce((url) => {
                if (url.includes('/flags/?v=2')) {
                  return Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        featureFlags: { 'x-flag': 'x-value', 'feature-1': false },
                        errorsWhileComputingFlags: false,
                      }),
                  })
                }

                return errorAPIResponse
              })
              .mockImplementation(() => {
                return errorAPIResponse
              })
          })

          insights.reloadFeatureFlags()
        })

        it('should return only latest results', async () => {
          expect(mocks.fetch).toHaveBeenCalledWith('https://us.i.insights.com/flags/?v=2', {
            body: JSON.stringify({
              token: 'TEST_API_KEY',
              distinct_id: insights.getDistinctId(),
              groups: {},
              person_properties: {},
              group_properties: {},
              $anon_distinct_id: insights.getAnonymousId(),
            }),
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'insights-core-tests',
            },
            signal: expect.anything(),
          })

          expect(insights.getFeatureFlags()).toEqual({
            'feature-1': true,
            'feature-2': true,
            'json-payload': true,
            'feature-variant': 'variant',
          })

          // now second call to feature flags
          await insights.reloadFeatureFlagsAsync()

          expect(mocks.fetch).toHaveBeenCalledWith('https://us.i.insights.com/flags/?v=2', {
            body: JSON.stringify({
              token: 'TEST_API_KEY',
              distinct_id: insights.getDistinctId(),
              groups: {},
              person_properties: {},
              group_properties: {},
              $anon_distinct_id: insights.getAnonymousId(),
            }),
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'insights-core-tests',
            },
            signal: expect.anything(),
          })

          expect(insights.getFeatureFlags()).toEqual({
            'feature-1': false,
            'x-flag': 'x-value',
          })

          expect(insights.getFeatureFlag('feature-1')).toEqual(false)
          expect(insights.getFeatureFlag('feature-variant')).toEqual(false)
          expect(insights.getFeatureFlag('feature-missing')).toEqual(false)
          expect(insights.getFeatureFlag('x-flag')).toEqual('x-value')

          expect(insights.isFeatureEnabled('feature-1')).toEqual(false)
          expect(insights.isFeatureEnabled('feature-variant')).toEqual(false)
          expect(insights.isFeatureEnabled('feature-missing')).toEqual(false)
          expect(insights.isFeatureEnabled('x-flag')).toEqual(true)
        })
      })

      it('should return the boolean value of a flag', async () => {
        expect(insights.isFeatureEnabled('feature-1')).toEqual(true)
        expect(insights.isFeatureEnabled('feature-variant')).toEqual(true)
        expect(insights.isFeatureEnabled('feature-missing')).toEqual(false)
      })

      it('should reload if groups are set', async () => {
        insights.group('my-group', 'is-great')
        await waitForPromises()
        expect(mocks.fetch).toHaveBeenCalledTimes(2)
        expect(JSON.parse((mocks.fetch.mock.calls[1][1].body as string) || '')).toMatchObject({
          groups: { 'my-group': 'is-great' },
        })
      })

      it('should capture $feature_flag_called when called', async () => {
        expect(insights.getFeatureFlag('feature-1')).toEqual(true)
        await waitForPromises()
        expect(mocks.fetch).toHaveBeenCalledTimes(2)

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              distinct_id: insights.getDistinctId(),
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_response: true,
                '$feature/feature-1': true,
                $used_bootstrap_value: false,
              },
              type: 'capture',
            },
          ],
        })

        // Only tracked once
        expect(insights.getFeatureFlag('feature-1')).toEqual(true)
        expect(mocks.fetch).toHaveBeenCalledTimes(2)
      })

      it('should capture $feature_flag_called again if new flags', async () => {
        expect(insights.getFeatureFlag('feature-1')).toEqual(true)
        await waitForPromises()
        expect(mocks.fetch).toHaveBeenCalledTimes(2)

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              distinct_id: insights.getDistinctId(),
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_response: true,
                '$feature/feature-1': true,
                $used_bootstrap_value: false,
              },
              type: 'capture',
            },
          ],
        })

        await insights.reloadFeatureFlagsAsync()
        insights.getFeatureFlag('feature-1')

        await waitForPromises()
        expect(mocks.fetch).toHaveBeenCalledTimes(4)

        expect(parseBody(mocks.fetch.mock.calls[3])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              distinct_id: insights.getDistinctId(),
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_response: true,
                '$feature/feature-1': true,
                $used_bootstrap_value: false,
              },
              type: 'capture',
            },
          ],
        })
      })

      it('should capture $feature_flag_called when called, but not add all cached flags', async () => {
        expect(insights.getFeatureFlag('feature-1')).toEqual(true)
        await waitForPromises()
        expect(mocks.fetch).toHaveBeenCalledTimes(2)

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              distinct_id: insights.getDistinctId(),
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_response: true,
                '$feature/feature-1': true,
                $used_bootstrap_value: false,
              },
              type: 'capture',
            },
          ],
        })

        // Only tracked once
        expect(insights.getFeatureFlag('feature-1')).toEqual(true)
        expect(mocks.fetch).toHaveBeenCalledTimes(2)
      })

      it('should persist feature flags', () => {
        const expectedFeatureFlags = {
          featureFlags: createMockFeatureFlags(),
          featureFlagPayloads: createMockFeatureFlagPayloads(),
        }
        const normalizedFeatureFlags = normalizeFlagsResponse(expectedFeatureFlags as InsightsV1FlagsResponse)

        expect(insights.getPersistedProperty(InsightsPersistedProperty.FeatureFlagDetails)).toEqual({
          flags: normalizedFeatureFlags.flags,
          requestId: undefined,
          evaluatedAt: undefined,
          errorsWhileComputingFlags: undefined,
          quotaLimited: undefined,
        })
      })

      it('should include feature flags in subsequent captures', async () => {
        insights.capture('test-event', { foo: 'bar' })

        await waitForPromises()

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: 'test-event',
              distinct_id: insights.getDistinctId(),
              properties: {
                $active_feature_flags: ['feature-1', 'feature-2', 'feature-variant', 'json-payload'],
                '$feature/feature-1': true,
                '$feature/feature-2': true,
                '$feature/json-payload': true,
                '$feature/feature-variant': 'variant',
              },
              type: 'capture',
            },
          ],
        })
      })

      it('should override flags', () => {
        insights.overrideFeatureFlag({
          'feature-2': false,
          'feature-variant': 'control',
        })
        expect(insights.getFeatureFlags()).toEqual({
          'json-payload': true,
          'feature-1': true,
          'feature-variant': 'control',
        })
      })
    })

    describe('when quota limited', () => {
      beforeEach(() => {
        ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
          _mocks.fetch.mockImplementation((url) => {
            if (url.includes('/flags/')) {
              return Promise.resolve({
                status: 200,
                text: () => Promise.resolve('ok'),
                json: () =>
                  Promise.resolve({
                    quotaLimited: ['feature_flags'],
                    featureFlags: {},
                    featureFlagPayloads: {},
                  }),
              })
            }
            return errorAPIResponse
          })
        })

        insights.reloadFeatureFlags()
      })

      it('should unset all flags when feature_flags is quota limited', async () => {
        // First verify the fetch was called correctly
        expect(mocks.fetch).toHaveBeenCalledWith('https://us.i.insights.com/flags/?v=2', {
          body: JSON.stringify({
            token: 'TEST_API_KEY',
            distinct_id: insights.getDistinctId(),
            groups: {},
            person_properties: {},
            group_properties: {},
            $anon_distinct_id: insights.getAnonymousId(),
          }),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'insights-core-tests',
          },
          signal: expect.anything(),
        })

        // When quota limited with no prior cached flags, return empty results
        expect(insights.getFeatureFlags()).toEqual({})
        expect(insights.getFeatureFlag('feature-1')).toEqual(undefined)
        expect(insights.getFeatureFlagPayloads()).toEqual({})
        expect(insights.getFeatureFlagPayload('feature-1')).toEqual(null)
      })

      it('should emit featureflags event with quotaLimited when quota limited', async () => {
        const featureFlagsHandler = jest.fn()
        insights.on('featureflags', featureFlagsHandler)

        await insights.reloadFeatureFlagsAsync()

        expect(featureFlagsHandler).toHaveBeenCalled()
        // Verify the flags response includes quotaLimited info
        const flagDetails = insights.getFeatureFlagDetails()
        expect(flagDetails?.quotaLimited).toEqual(['feature_flags'])
      })
    })
  })

  describe('bootstrapped feature flags', () => {
    beforeEach(() => {
      ;[insights, mocks] = createTestClient(
        'TEST_API_KEY',
        {
          flushAt: 1,
          bootstrap: {
            distinctId: 'tomato',
            featureFlags: {
              'bootstrap-1': 'variant-1',
              'feature-1': 'feature-1-bootstrap-value',
              enabled: true,
              disabled: false,
            },
            featureFlagPayloads: {
              'bootstrap-1': {
                some: 'key',
              },
              'feature-1': {
                color: 'feature-1-bootstrap-color',
              },
              'not-in-featureFlags': {
                color: { foo: 'bar' },
              },
              enabled: 200,
            },
          },
        },
        (_mocks) => {
          _mocks.fetch.mockImplementation((url) => {
            if (url.includes('/flags/')) {
              return Promise.reject(new Error('Not responding to emulate use of bootstrapped values'))
            }

            return Promise.resolve({
              status: 200,
              text: () => Promise.resolve('ok'),
              json: () =>
                Promise.resolve({
                  status: 'ok',
                }),
            })
          })
        }
      )
    })

    it('getFeatureFlags should return bootstrapped flags', async () => {
      expect(insights.getFeatureFlags()).toEqual({
        'bootstrap-1': 'variant-1',
        enabled: true,
        'feature-1': 'feature-1-bootstrap-value',
        'not-in-featureFlags': true,
      })
      expect(insights.getDistinctId()).toEqual('tomato')
      expect(insights.getAnonymousId()).toEqual('tomato')
    })

    it('getFeatureFlag should return bootstrapped flags', async () => {
      expect(insights.getFeatureFlag('my-flag')).toEqual(false)
      expect(insights.getFeatureFlag('bootstrap-1')).toEqual('variant-1')
      expect(insights.getFeatureFlag('enabled')).toEqual(true)
      expect(insights.getFeatureFlag('disabled')).toEqual(false)
      // If a bootstrapped payload is not in the feature flags, we treat it as true
      expect(insights.getFeatureFlag('not-in-featureFlags')).toEqual(true)
    })

    it('getFeatureFlag should capture $feature_flag_called with bootstrapped values', async () => {
      expect(insights.getFeatureFlag('bootstrap-1')).toEqual('variant-1')

      await waitForPromises()
      expect(mocks.fetch).toHaveBeenCalledTimes(1)

      expect(parseBody(mocks.fetch.mock.calls[0])).toMatchObject({
        batch: [
          {
            event: '$feature_flag_called',
            distinct_id: insights.getDistinctId(),
            properties: {
              $feature_flag: 'bootstrap-1',
              $feature_flag_response: 'variant-1',
              '$feature/bootstrap-1': 'variant-1',
              $feature_flag_bootstrapped_response: 'variant-1',
              $feature_flag_bootstrapped_payload: { some: 'key' },
              $used_bootstrap_value: true,
            },
            type: 'capture',
          },
        ],
      })
    })

    it('isFeatureEnabled should return true/false for bootstrapped flags', () => {
      expect(insights.isFeatureEnabled('my-flag')).toEqual(false)
      expect(insights.isFeatureEnabled('bootstrap-1')).toEqual(true)
      expect(insights.isFeatureEnabled('enabled')).toEqual(true)
      expect(insights.isFeatureEnabled('disabled')).toEqual(false)
      expect(insights.isFeatureEnabled('not-in-featureFlags')).toEqual(true)
    })

    it('getFeatureFlagPayload should return bootstrapped payloads', () => {
      expect(insights.getFeatureFlagPayload('my-flag')).toEqual(null)
      expect(insights.getFeatureFlagPayload('bootstrap-1')).toEqual({
        some: 'key',
      })
      expect(insights.getFeatureFlagPayload('enabled')).toEqual(200)
      expect(insights.getFeatureFlagPayload('not-in-featureFlags')).toEqual({
        color: { foo: 'bar' },
      })
    })

    describe('when loaded', () => {
      beforeEach(() => {
        ;[insights, mocks] = createTestClient(
          'TEST_API_KEY',
          {
            flushAt: 1,
            bootstrap: {
              distinctId: 'tomato',
              featureFlags: {
                'bootstrap-1': 'variant-1',
                'feature-1': 'feature-1-bootstrap-value',
                enabled: true,
                disabled: false,
              },
              featureFlagPayloads: {
                'bootstrap-1': {
                  some: 'key',
                },
                'feature-1': {
                  color: 'feature-1-bootstrap-color',
                },
                enabled: 200,
              },
            },
          },
          (_mocks) => {
            _mocks.fetch.mockImplementation((url) => {
              if (url.includes('/flags/')) {
                return Promise.resolve({
                  status: 200,
                  text: () => Promise.resolve('ok'),
                  json: () =>
                    Promise.resolve({
                      featureFlags: createMockFeatureFlags(),
                      featureFlagPayloads: createMockFeatureFlagPayloads(),
                    }),
                })
              }

              return Promise.resolve({
                status: 200,
                text: () => Promise.resolve('ok'),
                json: () =>
                  Promise.resolve({
                    status: 'ok',
                  }),
              })
            })
          }
        )

        insights.reloadFeatureFlags()
      })

      it('should load new feature flags', async () => {
        expect(mocks.fetch).toHaveBeenCalledWith('https://us.i.insights.com/flags/?v=2', {
          body: JSON.stringify({
            token: 'TEST_API_KEY',
            distinct_id: insights.getDistinctId(),
            groups: {},
            person_properties: {},
            group_properties: {},
            $anon_distinct_id: 'tomato',
          }),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'insights-core-tests',
          },
          signal: expect.anything(),
        })

        expect(insights.getFeatureFlags()).toEqual({
          'feature-1': true,
          'feature-2': true,
          'json-payload': true,
          'feature-variant': 'variant',
        })
      })

      it('should load new feature flag payloads', async () => {
        expect(mocks.fetch).toHaveBeenCalledWith('https://us.i.insights.com/flags/?v=2', {
          body: JSON.stringify({
            token: 'TEST_API_KEY',
            distinct_id: insights.getDistinctId(),
            groups: {},
            person_properties: {},
            group_properties: {},
            $anon_distinct_id: 'tomato',
          }),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'insights-core-tests',
          },
          signal: expect.anything(),
        })
        expect(insights.getFeatureFlagPayload('feature-1')).toEqual({
          color: 'blue',
        })
        expect(insights.getFeatureFlagPayload('feature-variant')).toEqual([5])
      })

      it('should capture $feature_flag_called with bootstrapped values', async () => {
        expect(insights.getFeatureFlag('feature-1')).toEqual(true)

        await waitForPromises()
        expect(mocks.fetch).toHaveBeenCalledTimes(2)

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              distinct_id: insights.getDistinctId(),
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_response: true,
                '$feature/feature-1': true,
                $feature_flag_bootstrapped_response: 'feature-1-bootstrap-value',
                $feature_flag_bootstrapped_payload: { color: 'feature-1-bootstrap-color' },
                $used_bootstrap_value: false,
              },
              type: 'capture',
            },
          ],
        })
      })
    })
  })

  describe('bootstapped do not overwrite values', () => {
    beforeEach(() => {
      ;[insights, mocks] = createTestClient(
        'TEST_API_KEY',
        {
          flushAt: 1,
          bootstrap: {
            distinctId: 'tomato',
            featureFlags: { 'bootstrap-1': 'variant-1', enabled: true, disabled: false },
            featureFlagPayloads: {
              'bootstrap-1': {
                some: 'key',
              },
              enabled: 200,
            },
          },
        },
        (_mocks) => {
          _mocks.fetch.mockImplementation((url) => {
            if (url.includes('/flags/')) {
              return Promise.resolve({
                status: 200,
                text: () => Promise.resolve('ok'),
                json: () =>
                  Promise.resolve({
                    featureFlags: createMockFeatureFlags(),
                    featureFlagPayloads: createMockFeatureFlagPayloads(),
                  }),
              })
            }

            return Promise.resolve({
              status: 200,
              text: () => Promise.resolve('ok'),
              json: () =>
                Promise.resolve({
                  status: 'ok',
                }),
            })
          })
        },
        {
          distinct_id: '123',
          feature_flags: { 'bootstrap-1': 'variant-2' },
          feature_flag_payloads: { 'bootstrap-1': { some: 'other-key' } },
        }
      )
    })

    it('distinct id should not be overwritten if already there', () => {
      expect(insights.getDistinctId()).toEqual('123')
    })

    it('flags should not be overwritten if already there', () => {
      expect(insights.getFeatureFlag('bootstrap-1')).toEqual('variant-2')
    })

    it('flag payloads should not be overwritten if already there', () => {
      expect(insights.getFeatureFlagPayload('bootstrap-1')).toEqual({
        some: 'other-key',
      })
    })
  })
})
