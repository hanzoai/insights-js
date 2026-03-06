import { InsightsFeatureFlags } from '../insights-featureflags'
import { Insights } from '../insights-core'
import { InsightsConfig } from '../types'
import { assignableWindow } from '../utils/globals'

describe('Evaluation Tags/Contexts', () => {
    let insights: Insights
    let featureFlags: InsightsFeatureFlags
    let mockSendRequest: jest.Mock

    beforeEach(() => {
        // Create a mock Insights instance
        insights = {
            config: {} as InsightsConfig,
            persistence: {
                get_distinct_id: jest.fn().mockReturnValue('test-distinct-id'),
                get_initial_props: jest.fn().mockReturnValue({}),
            },
            get_property: jest.fn().mockReturnValue({}),
            get_distinct_id: jest.fn().mockReturnValue('test-distinct-id'),
            getGroups: jest.fn().mockReturnValue({}),
            requestRouter: {
                endpointFor: jest.fn().mockReturnValue('/flags/?v=2'),
            },
            _send_request: jest.fn(),
            _shouldDisableFlags: jest.fn().mockReturnValue(false),
        } as any

        mockSendRequest = insights._send_request as jest.Mock

        featureFlags = new InsightsFeatureFlags(insights)
    })

    describe('_getValidEvaluationEnvironments', () => {
        it('should return empty array when no contexts configured', () => {
            insights.config.evaluation_contexts = undefined
            const result = (featureFlags as any)._getValidEvaluationEnvironments()
            expect(result).toEqual([])
        })

        it('should return empty array when contexts is empty', () => {
            insights.config.evaluation_contexts = []
            const result = (featureFlags as any)._getValidEvaluationEnvironments()
            expect(result).toEqual([])
        })

        it('should filter out invalid contexts', () => {
            insights.config.evaluation_contexts = [
                'production',
                '',
                'staging',
                null as any,
                'development',
                undefined as any,
                '   ', // whitespace only
            ] as readonly string[]

            const result = (featureFlags as any)._getValidEvaluationEnvironments()
            expect(result).toEqual(['production', 'staging', 'development'])
        })

        it('should handle readonly array of valid contexts', () => {
            const contexts: readonly string[] = ['production', 'staging', 'development']
            insights.config.evaluation_contexts = contexts

            const result = (featureFlags as any)._getValidEvaluationEnvironments()
            expect(result).toEqual(['production', 'staging', 'development'])
        })

        it('should support deprecated evaluation_environments field', () => {
            assignableWindow.INSIGHTS_DEBUG = true
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
            insights.config.evaluation_environments = ['production', 'staging']

            // Call multiple times
            ;(featureFlags as any)._getValidEvaluationEnvironments()
            ;(featureFlags as any)._getValidEvaluationEnvironments()

            const result = (featureFlags as any)._getValidEvaluationEnvironments()
            expect(result).toEqual(['production', 'staging'])

            // Warning should be logged only once
            expect(warnSpy).toHaveBeenCalledTimes(1)
            expect(warnSpy).toHaveBeenCalledWith(
                '[Insights.js] [FeatureFlags]',
                'evaluation_environments is deprecated. Use evaluation_contexts instead. evaluation_environments will be removed in a future version.'
            )

            warnSpy.mockRestore()
            assignableWindow.INSIGHTS_DEBUG = false
        })

        it('should prioritize evaluation_contexts over evaluation_environments', () => {
            insights.config.evaluation_contexts = ['new-context']
            insights.config.evaluation_environments = ['old-environment']
            const result = (featureFlags as any)._getValidEvaluationEnvironments()
            expect(result).toEqual(['new-context'])
        })
    })

    describe('_shouldIncludeEvaluationEnvironments', () => {
        it('should return false when no valid contexts', () => {
            insights.config.evaluation_contexts = ['', '   ']
            const result = (featureFlags as any)._shouldIncludeEvaluationEnvironments()
            expect(result).toBe(false)
        })

        it('should return true when valid contexts exist', () => {
            insights.config.evaluation_contexts = ['production']
            const result = (featureFlags as any)._shouldIncludeEvaluationEnvironments()
            expect(result).toBe(true)
        })
    })

    describe('_callFlagsEndpoint', () => {
        it('should include evaluation_contexts in request when configured', () => {
            insights.config.evaluation_contexts = ['production', 'experiment-A']
            ;(featureFlags as any)._callFlagsEndpoint()

            expect(mockSendRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        evaluation_contexts: ['production', 'experiment-A'],
                    }),
                })
            )
        })

        it('should not include evaluation_contexts when not configured', () => {
            insights.config.evaluation_contexts = undefined
            ;(featureFlags as any)._callFlagsEndpoint()

            expect(mockSendRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.not.objectContaining({
                        evaluation_contexts: expect.anything(),
                    }),
                })
            )
        })

        it('should not include evaluation_contexts when empty array', () => {
            insights.config.evaluation_contexts = []
            ;(featureFlags as any)._callFlagsEndpoint()

            expect(mockSendRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.not.objectContaining({
                        evaluation_contexts: expect.anything(),
                    }),
                })
            )
        })

        it('should filter out invalid contexts before sending', () => {
            insights.config.evaluation_contexts = ['production', '', null as any, 'staging']
            ;(featureFlags as any)._callFlagsEndpoint()

            expect(mockSendRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        evaluation_contexts: ['production', 'staging'],
                    }),
                })
            )
        })

        it('should support deprecated evaluation_environments field', () => {
            insights.config.evaluation_environments = ['production', 'experiment-A']
            ;(featureFlags as any)._callFlagsEndpoint()

            expect(mockSendRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        evaluation_contexts: ['production', 'experiment-A'],
                    }),
                })
            )
        })
    })
})
