import { InsightsPersistedProperty, InsightsV2FlagsResponse } from '@/types'
import { normalizeFlagsResponse } from '@/featureFlagUtils'
import {
  parseBody,
  waitForPromises,
  createTestClient,
  InsightsCoreTestClient,
  InsightsCoreTestClientMocks,
} from '@/testing'

describe('Insights Feature Flags v4', () => {
  let insights: InsightsCoreTestClient
  let mocks: InsightsCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01'))

  const createMockFeatureFlags = (): Partial<InsightsV2FlagsResponse['flags']> => ({
    'feature-1': {
      key: 'feature-1',
      enabled: true,
      variant: undefined,
      reason: {
        code: 'matched_condition',
        description: 'matched condition set 1',
        condition_index: 0,
      },
      metadata: {
        id: 1,
        version: 1,
        description: 'feature-1',
        payload: '{"color":"blue"}',
      },
    },
    'feature-2': {
      key: 'feature-2',
      enabled: true,
      variant: undefined,
      reason: {
        code: 'matched_condition',
        description: 'matched condition set 2',
        condition_index: 1,
      },
      metadata: {
        id: 2,
        version: 42,
        description: 'feature-2',
        payload: undefined,
      },
    },
    'feature-variant': {
      key: 'feature-variant',
      enabled: true,
      variant: 'variant',
      reason: {
        code: 'matched_condition',
        description: 'matched condition set 3',
        condition_index: 2,
      },
      metadata: {
        id: 3,
        version: 1,
        description: 'feature-variant',
        payload: '[5]',
      },
    },
    'json-payload': {
      key: 'json-payload',
      enabled: true,
      variant: undefined,
      reason: {
        code: 'matched_condition',
        description: 'matched condition set 4',
        condition_index: 4,
      },
      metadata: {
        id: 4,
        version: 1,
        description: 'json-payload',
        payload: '{"a":"payload"}',
      },
    },
  })

  const expectedFeatureFlagResponses = {
    'feature-1': true,
    'feature-2': true,
    'feature-variant': 'variant',
    'json-payload': true,
  }

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
                flags: createMockFeatureFlags(),
                requestId: '0152a345-295f-4fba-adac-2e6ea9c91082',
                evaluatedAt: 1640995200000,
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

    it('should load persisted feature flags', () => {
      const flagsResponse = { flags: createMockFeatureFlags() } as InsightsV2FlagsResponse
      const normalizedFeatureFlags = normalizeFlagsResponse(flagsResponse)
      insights.setPersistedProperty(InsightsPersistedProperty.FeatureFlagDetails, normalizedFeatureFlags)
      expect(insights.getFeatureFlags()).toEqual(expectedFeatureFlagResponses)
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
      expect(flags).toEqual(expectedFeatureFlagResponses)
    })

    it('should execute pending reload after current request completes', async () => {
      // This test verifies the fix for the race condition where identify() calls
      // with $anon_distinct_id were dropped when preloadFeatureFlags was in flight.
      // See: https://github.com/Insights/insights-ios/issues/456

      let resolveFirstRequest: () => void
      let resolveSecondRequest: () => void
      let fetchCallCount = 0

      ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
        _mocks.fetch.mockImplementation((url) => {
          if (url.includes('/flags/')) {
            fetchCallCount++
            const currentCall = fetchCallCount

            if (currentCall === 1) {
              // First request - delay to simulate network latency
              return new Promise((resolve) => {
                resolveFirstRequest = () =>
                  resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        flags: createMockFeatureFlags(),
                        requestId: 'first-request',
                        evaluatedAt: 1640995200000,
                      }),
                  })
              })
            } else {
              // Second request (pending reload)
              return new Promise((resolve) => {
                resolveSecondRequest = () =>
                  resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        flags: createMockFeatureFlags(),
                        requestId: 'second-request',
                        evaluatedAt: 1640995200001,
                      }),
                  })
              })
            }
          }

          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve('ok'),
            json: () => Promise.resolve({ status: 'ok' }),
          })
        })
      })

      // Start first request (simulates preloadFeatureFlags)
      const firstReload = insights.reloadFeatureFlagsAsync()

      // Wait a tick to ensure first request is in flight
      await waitForPromises()

      // Start second request while first is in flight (simulates identify() -> reloadFeatureFlags())
      const secondReload = insights.reloadFeatureFlagsAsync()

      // At this point, fetch should have been called once
      expect(fetchCallCount).toBe(1)

      // Complete the first request
      resolveFirstRequest!()
      await firstReload
      await waitForPromises()

      // After first request completes, the pending reload should be triggered
      // and fetch should be called again
      expect(fetchCallCount).toBe(2)

      // Complete the second request
      resolveSecondRequest!()
      await secondReload
      await waitForPromises()

      // Both requests should have completed
      expect(fetchCallCount).toBe(2)
    })

    it('should emit featureflags event when flags are loaded', async () => {
      const receivedFlags: any[] = []
      const unsubscribe = insights.onFeatureFlags((flags) => {
        receivedFlags.push(flags)
      })

      await insights.reloadFeatureFlagsAsync()
      unsubscribe()

      expect(receivedFlags).toEqual([expectedFeatureFlagResponses])
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

      it.each([
        ['feature-variant', [5]],
        ['feature-1', { color: 'blue' }],
        ['feature-2', null],
      ])('should return correct payload for flag %s', (flagKey, expectedPayload) => {
        expect(insights.getFeatureFlagPayload(flagKey)).toEqual(expectedPayload)
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
                        flags: createMockFeatureFlags(),
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
                        flags: {
                          'x-flag': {
                            key: 'x-flag',
                            enabled: true,
                            variant: 'x-value',
                            reason: {
                              code: 'matched_condition',
                              description: 'matched condition set 5',
                              condition_index: 0,
                            },
                            metadata: {
                              id: 5,
                              version: 1,
                              description: 'x-flag',
                              payload: '{"x":"value"}',
                            },
                          },
                          'feature-1': {
                            key: 'feature-1',
                            enabled: false,
                            variant: undefined,
                            reason: {
                              code: 'matched_condition',
                              description: 'matched condition set 6',
                              condition_index: 0,
                            },
                            metadata: {
                              id: 6,
                              version: 1,
                              description: 'feature-1',
                              payload: '{"color":"blue"}',
                            },
                          },
                        },
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

      describe('when subsequent flags calls return failed flags with errorsWhileComputingFlags', () => {
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
                        flags: createMockFeatureFlags(),
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
                        flags: {
                          'x-flag': {
                            key: 'x-flag',
                            enabled: true,
                            variant: 'x-value',
                            failed: false,
                            reason: {
                              code: 'matched_condition',
                              description: 'matched condition set 5',
                              condition_index: 0,
                            },
                            metadata: {
                              id: 5,
                              version: 1,
                              description: 'x-flag',
                              payload: '{"x":"value"}',
                            },
                          },
                          'feature-1': {
                            key: 'feature-1',
                            enabled: false,
                            variant: undefined,
                            failed: true,
                            reason: {
                              code: 'database_error',
                              description: 'Database connection error during evaluation',
                              condition_index: undefined,
                            },
                            metadata: {
                              id: 1,
                              version: 1,
                              description: 'feature-1',
                              payload: undefined,
                            },
                          },
                        },
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

        it('should filter out failed flags and preserve their cached values', async () => {
          expect(insights.getFeatureFlags()).toEqual({
            'feature-1': true,
            'feature-2': true,
            'json-payload': true,
            'feature-variant': 'variant',
          })

          // second call returns feature-1 as failed (should be filtered out)
          // and x-flag as successful (should be merged in)
          await insights.reloadFeatureFlagsAsync()

          // feature-1 should retain its cached value (true), not be overwritten with false
          expect(insights.getFeatureFlags()).toEqual({
            'feature-1': true,
            'feature-2': true,
            'json-payload': true,
            'feature-variant': 'variant',
            'x-flag': 'x-value',
          })

          expect(insights.getFeatureFlag('feature-1')).toEqual(true)
          expect(insights.getFeatureFlag('x-flag')).toEqual('x-value')
          expect(insights.isFeatureEnabled('feature-1')).toEqual(true)
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
                        flags: createMockFeatureFlags(),
                        requestId: '18043bf7-9cf6-44cd-b959-9662ee20d371',
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
                        flags: {
                          'x-flag': {
                            key: 'x-flag',
                            enabled: true,
                            variant: 'x-value',
                            reason: {
                              code: 'matched_condition',
                              description: 'matched condition set 5',
                              condition_index: 0,
                            },
                            metadata: {
                              id: 5,
                              version: 1,
                              description: 'x-flag',
                              payload: '{"x":"value"}',
                            },
                          },
                          'feature-1': {
                            key: 'feature-1',
                            enabled: false,
                            variant: undefined,
                            reason: {
                              code: 'matched_condition',
                              description: 'matched condition set 6',
                              condition_index: 0,
                            },
                            metadata: {
                              id: 6,
                              version: 1,
                              description: 'feature-1',
                              payload: '{"color":"blue"}',
                            },
                          },
                        },
                        errorsWhileComputingFlags: false,
                        requestId: 'bccd3c21-38e6-4499-a804-89f77ddcd1fc',
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

      it.each([
        {
          key: 'feature-1',
          expected_response: true,
          expected_id: 1,
          expected_version: 1,
          expected_reason: 'matched condition set 1',
        },
        {
          key: 'feature-2',
          expected_response: true,
          expected_id: 2,
          expected_version: 42,
          expected_reason: 'matched condition set 2',
        },
        {
          key: 'feature-variant',
          expected_response: 'variant',
          expected_id: 3,
          expected_version: 1,
          expected_reason: 'matched condition set 3',
        },
        {
          key: 'json-payload',
          expected_response: true,
          expected_id: 4,
          expected_version: 1,
          expected_reason: 'matched condition set 4',
        },
      ])(
        'should capture feature_flag_called when called for %s',
        async ({ key, expected_response, expected_id, expected_version, expected_reason }) => {
          expect(insights.getFeatureFlag(key)).toEqual(expected_response)
          await waitForPromises()
          expect(mocks.fetch).toHaveBeenCalledTimes(2)

          expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
            batch: [
              {
                event: '$feature_flag_called',
                distinct_id: insights.getDistinctId(),
                properties: {
                  $feature_flag: key,
                  $feature_flag_response: expected_response,
                  $feature_flag_id: expected_id,
                  $feature_flag_version: expected_version,
                  $feature_flag_reason: expected_reason,
                  '$feature/feature-1': true,
                  $used_bootstrap_value: false,
                  $feature_flag_request_id: '0152a345-295f-4fba-adac-2e6ea9c91082',
                  $feature_flag_evaluated_at: expect.any(Number),
                },
                type: 'capture',
              },
            ],
          })

          // Only tracked once
          expect(insights.getFeatureFlag('feature-1')).toEqual(true)
          expect(mocks.fetch).toHaveBeenCalledTimes(2)
        }
      )

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
                $feature_flag_request_id: '0152a345-295f-4fba-adac-2e6ea9c91082',
                $feature_flag_evaluated_at: expect.any(Number),
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
          flags: createMockFeatureFlags(),
          requestId: '0152a345-295f-4fba-adac-2e6ea9c91082',
          evaluatedAt: 1640995200000,
        }
        const normalizedFeatureFlags = normalizeFlagsResponse(expectedFeatureFlags as InsightsV2FlagsResponse)

        expect(insights.getPersistedProperty(InsightsPersistedProperty.FeatureFlagDetails)).toEqual({
          flags: normalizedFeatureFlags.flags,
          requestId: '0152a345-295f-4fba-adac-2e6ea9c91082',
          evaluatedAt: 1640995200000,
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

        const received = insights.getFeatureFlags()

        expect(received).toEqual({
          'json-payload': true,
          'feature-1': true,
          'feature-variant': 'control',
        })
      })

      describe('getFeatureFlagResult', () => {
        it('should return correct result for a boolean flag', () => {
          const result = insights.getFeatureFlagResult('feature-1')
          expect(result).toEqual({
            key: 'feature-1',
            enabled: true,
            variant: undefined,
            payload: { color: 'blue' },
          })
        })

        it('should return correct result for a multivariate flag', () => {
          const result = insights.getFeatureFlagResult('feature-variant')
          expect(result).toEqual({
            key: 'feature-variant',
            enabled: true,
            variant: 'variant',
            payload: [5],
          })
        })

        it('should return undefined for a missing flag', () => {
          expect(insights.getFeatureFlagResult('nonexistent-flag')).toEqual(undefined)
        })

        it('should return undefined when flags are not loaded at all', () => {
          const [freshInsights] = createTestClient('TEST_API_KEY', { flushAt: 1 })
          expect(freshInsights.getFeatureFlagResult('feature-1')).toEqual(undefined)
        })

        it('should return correct results when only legacy v1 persisted data exists', () => {
          const [legacyInsights] = createTestClient('TEST_API_KEY', { flushAt: 1 }, undefined, {
            [InsightsPersistedProperty.FeatureFlags]: { 'feature-1': true },
            [InsightsPersistedProperty.FeatureFlagPayloads]: { 'feature-1': '{"color":"blue"}' },
          })

          expect(legacyInsights.getFeatureFlagResult('feature-1')).toEqual({
            key: 'feature-1',
            enabled: true,
            variant: undefined,
            payload: { color: 'blue' },
          })

          // Missing flag when flags are loaded should return null, not undefined
          expect(legacyInsights.getFeatureFlagPayload('missing-flag')).toEqual(null)
        })

        it('should send $feature_flag_called event on first call', async () => {
          insights.getFeatureFlagResult('feature-1')
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
                  $feature_flag_id: 1,
                  $feature_flag_version: 1,
                  $feature_flag_reason: 'matched condition set 1',
                  $used_bootstrap_value: false,
                  $feature_flag_request_id: '0152a345-295f-4fba-adac-2e6ea9c91082',
                  $feature_flag_evaluated_at: 1640995200000,
                },
                type: 'capture',
              },
            ],
          })
        })

        it('should NOT send event when sendEvent: false', async () => {
          insights.getFeatureFlagResult('feature-1', { sendEvent: false })
          await waitForPromises()
          // Only the flags fetch call, no event capture
          expect(mocks.fetch).toHaveBeenCalledTimes(1)
        })

        it('should NOT send duplicate events for the same flag key', async () => {
          insights.getFeatureFlagResult('feature-1')
          await waitForPromises()
          expect(mocks.fetch).toHaveBeenCalledTimes(2)

          insights.getFeatureFlagResult('feature-1')
          await waitForPromises()
          // Still only 2 calls — no second event
          expect(mocks.fetch).toHaveBeenCalledTimes(2)
        })

        it('should send event again after reloadFeatureFlagsAsync', async () => {
          insights.getFeatureFlagResult('feature-1')
          await waitForPromises()
          expect(mocks.fetch).toHaveBeenCalledTimes(2)

          await insights.reloadFeatureFlagsAsync()
          insights.getFeatureFlagResult('feature-1')
          await waitForPromises()
          // flags reload + second event capture
          expect(mocks.fetch).toHaveBeenCalledTimes(4)
        })

        it('should respect instance-level sendFeatureFlagEvent: false', async () => {
          const [noEventInsights, noEventMocks] = createTestClient(
            'TEST_API_KEY',
            { flushAt: 1, sendFeatureFlagEvent: false },
            (_mocks) => {
              _mocks.fetch.mockImplementation((url) => {
                return Promise.resolve({
                  status: 200,
                  text: () => Promise.resolve('ok'),
                  json: () =>
                    Promise.resolve({
                      flags: createMockFeatureFlags(),
                      requestId: '0152a345-295f-4fba-adac-2e6ea9c91082',
                    }),
                })
              })
            }
          )
          noEventInsights.reloadFeatureFlags()
          await waitForPromises()

          noEventInsights.getFeatureFlagResult('feature-1')
          await waitForPromises()

          expect(noEventMocks.fetch).toHaveBeenCalledTimes(1)
        })

        it('should include $feature_flag_error FLAG_MISSING for a missing flag when flags are cached', async () => {
          insights.getFeatureFlagResult('nonexistent-flag')
          await waitForPromises()

          expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
            batch: [
              {
                event: '$feature_flag_called',
                properties: {
                  $feature_flag: 'nonexistent-flag',
                  $feature_flag_error: 'flag_missing',
                },
              },
            ],
          })
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
                    flags: {},
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

      it('getFeatureFlagResult should include QUOTA_LIMITED error', async () => {
        insights.getFeatureFlagResult('feature-1')
        await waitForPromises()

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_error: 'quota_limited',
              },
            },
          ],
        })
      })

      it('getFeatureFlagResult should NOT include FLAG_MISSING when quota limited', async () => {
        insights.getFeatureFlagResult('nonexistent-flag')
        await waitForPromises()

        const body = parseBody(mocks.fetch.mock.calls[1])
        const error = body.batch[0].properties.$feature_flag_error
        expect(error).toEqual('quota_limited')
        expect(error).not.toContain('flag_missing')
      })
    })

    describe('getFeatureFlagResult error scenarios', () => {
      it('should include ERRORS_WHILE_COMPUTING error', async () => {
        ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
          _mocks.fetch.mockImplementation((url) => {
            if (url.includes('/flags/')) {
              return Promise.resolve({
                status: 200,
                text: () => Promise.resolve('ok'),
                json: () =>
                  Promise.resolve({
                    flags: createMockFeatureFlags(),
                    errorsWhileComputingFlags: true,
                    requestId: 'test-request-id',
                  }),
              })
            }
            return Promise.resolve({
              status: 200,
              text: () => Promise.resolve('ok'),
              json: () => Promise.resolve({ status: 'ok' }),
            })
          })
        })
        insights.reloadFeatureFlags()
        await waitForPromises()

        insights.getFeatureFlagResult('feature-1')
        await waitForPromises()

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_response: true,
                $feature_flag_error: 'errors_while_computing_flags',
              },
            },
          ],
        })
      })

      it('should include TIMEOUT error when request timed out', async () => {
        ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
          _mocks.fetch.mockImplementation((url) => {
            if (url.includes('/flags/')) {
              const abortError = new Error('The operation was aborted')
              abortError.name = 'AbortError'
              return Promise.reject(abortError)
            }
            return Promise.resolve({
              status: 200,
              text: () => Promise.resolve('ok'),
              json: () => Promise.resolve({ status: 'ok' }),
            })
          })
        })
        insights.reloadFeatureFlags()
        await waitForPromises()

        insights.getFeatureFlagResult('feature-1')
        await waitForPromises()

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_error: 'timeout',
              },
            },
          ],
        })
      })

      it('should include api_error with status code', async () => {
        ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
          _mocks.fetch.mockImplementation((url) => {
            if (url.includes('/flags/')) {
              return Promise.resolve({
                status: 503,
                text: () => Promise.resolve('Service Unavailable'),
                json: () => Promise.resolve({ error: 'service unavailable' }),
              })
            }
            return Promise.resolve({
              status: 200,
              text: () => Promise.resolve('ok'),
              json: () => Promise.resolve({ status: 'ok' }),
            })
          })
        })
        insights.reloadFeatureFlags()
        await waitForPromises()

        insights.getFeatureFlagResult('feature-1')
        await waitForPromises()

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_error: 'api_error_503',
              },
            },
          ],
        })
      })

      it('should include CONNECTION_ERROR for network failures', async () => {
        ;[insights, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
          _mocks.fetch.mockImplementation((url) => {
            if (url.includes('/flags/')) {
              return Promise.reject(new TypeError('Failed to fetch'))
            }
            return Promise.resolve({
              status: 200,
              text: () => Promise.resolve('ok'),
              json: () => Promise.resolve({ status: 'ok' }),
            })
          })
        })
        insights.reloadFeatureFlags()
        await waitForPromises()

        insights.getFeatureFlagResult('feature-1')
        await waitForPromises()

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_error: 'connection_error',
              },
            },
          ],
        })
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
              enabled: 200,
              'not-in-featureFlags': {
                color: { foo: 'bar' },
              },
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
                      flags: createMockFeatureFlags(),
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

      it('should capture feature_flag_called with bootstrapped values', async () => {
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
                    flags: createMockFeatureFlags(),
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
        // Storage cache
        {
          distinct_id: '123',
          feature_flag_details: {
            flags: {
              'bootstrap-1': {
                key: 'bootstrap-1',
                enabled: true,
                variant: 'variant-2',
                reason: {
                  code: 'matched_condition',
                  description: 'matched condition set 1',
                  condition_index: 0,
                },
                metadata: {
                  id: 1,
                  version: 1,
                  description: 'bootstrap-1',
                  payload: '{"some":"other-key"}',
                },
              },
              requestId: '8c865d72-94ef-4088-8b4e-cdb7983f0f81',
            },
          },
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
