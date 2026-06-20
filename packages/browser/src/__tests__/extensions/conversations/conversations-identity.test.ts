/* eslint-disable compat/compat */
import { InsightsConversations, ConversationsManager } from '../../../extensions/conversations/insights-conversations'
import { ConversationsRemoteConfig } from '../../../insights-conversations-types'
import { Insights } from '../../../insights-core'
import { RemoteConfig } from '../../../types'
import { assignableWindow } from '../../../utils/globals'
import { createMockInsights, createMockConfig, createMockPersistence } from '../../helpers/insights-instance'

describe('Conversations Identity Verification', () => {
    let conversations: InsightsConversations
    let mockInsights: Insights
    let mockManager: ConversationsManager

    const remoteConfig: Partial<RemoteConfig> = {
        conversations: {
            enabled: true,
            token: 'test-conversations-token',
        } as ConversationsRemoteConfig,
    }

    beforeEach(() => {
        localStorage.clear()
        jest.clearAllMocks()

        mockManager = {
            show: jest.fn(),
            hide: jest.fn(),
            reset: jest.fn(),
            isVisible: jest.fn().mockReturnValue(true),
            sendMessage: jest.fn(),
            getMessages: jest.fn(),
            markAsRead: jest.fn(),
            getTickets: jest.fn(),
            requestRestoreLink: jest.fn(),
            restoreFromToken: jest.fn(),
            restoreFromUrlToken: jest.fn(),
            getCurrentTicketId: jest.fn(),
            getWidgetSessionId: jest.fn(),
            setIdentity: jest.fn(),
            clearIdentity: jest.fn(),
        } as unknown as ConversationsManager

        const config = createMockConfig({
            api_host: 'https://test.insights.hanzo.ai',
            token: 'test-token',
            disable_conversations: false,
        })

        mockInsights = createMockInsights({
            config,
            persistence: createMockPersistence({
                props: {},
            }),
            requestRouter: {
                endpointFor: jest.fn().mockReturnValue('https://test.insights.hanzo.ai/api/test'),
            } as any,
            consent: {
                isOptedOut: jest.fn().mockReturnValue(false),
            } as any,
            get_distinct_id: jest.fn().mockReturnValue('test-distinct-id'),
            on: jest.fn().mockReturnValue(jest.fn()),
            setIdentity: jest.fn((distinctId: string, hash: string) => {
                mockInsights.config.identity_distinct_id = distinctId
                mockInsights.config.identity_hash = hash
                ;(mockInsights as any).conversations?._onIdentityChanged()
            }),
            clearIdentity: jest.fn(() => {
                delete mockInsights.config.identity_distinct_id
                delete mockInsights.config.identity_hash
                ;(mockInsights as any).conversations?._onIdentityCleared()
            }),
        })

        assignableWindow.__InsightsExtensions__ = {
            initConversations: undefined,
            loadExternalDependency: jest.fn((_instance, _path, callback) => {
                assignableWindow.__InsightsExtensions__!.initConversations = jest.fn().mockReturnValue(mockManager)
                callback(null)
            }),
        }

        conversations = new InsightsConversations(mockInsights)
        ;(mockInsights as any).conversations = conversations
    })

    function loadConversations() {
        conversations.onRemoteConfig(remoteConfig as RemoteConfig)
    }

    describe('insights.setIdentity', () => {
        it('should store identity on top-level config', () => {
            mockInsights.setIdentity('user_123', 'a1b2c3d4')

            expect(mockInsights.config.identity_distinct_id).toBe('user_123')
            expect(mockInsights.config.identity_hash).toBe('a1b2c3d4')
        })

        it('should forward to manager via _onIdentityChanged when manager is loaded', () => {
            loadConversations()
            mockInsights.setIdentity('user_123', 'a1b2c3d4')

            expect(mockManager.setIdentity).toHaveBeenCalled()
        })

        it('should store on config even when manager is not loaded yet', () => {
            mockInsights.setIdentity('user_123', 'a1b2c3d4')

            expect(mockInsights.config.identity_distinct_id).toBe('user_123')
            expect(mockInsights.config.identity_hash).toBe('a1b2c3d4')
            expect(mockManager.setIdentity).not.toHaveBeenCalled()
        })

        it('should be read by manager when it loads later', () => {
            mockInsights.setIdentity('user_123', 'a1b2c3d4')

            expect(mockInsights.config.identity_distinct_id).toBe('user_123')

            loadConversations()

            expect(assignableWindow.__InsightsExtensions__!.initConversations).toHaveBeenCalled()
        })
    })

    describe('insights.clearIdentity', () => {
        it('should remove identity from insights.config', () => {
            mockInsights.config.identity_distinct_id = 'user_123'
            mockInsights.config.identity_hash = 'a1b2c3d4'
            mockInsights.clearIdentity()

            expect(mockInsights.config.identity_distinct_id).toBeUndefined()
            expect(mockInsights.config.identity_hash).toBeUndefined()
        })

        it('should forward to manager via _onIdentityCleared when manager is loaded', () => {
            loadConversations()
            mockInsights.clearIdentity()

            expect(mockManager.clearIdentity).toHaveBeenCalled()
        })

        it('should not throw when manager is not loaded', () => {
            expect(() => mockInsights.clearIdentity()).not.toThrow()
        })
    })

    describe('reset', () => {
        it('should delegate reset to manager', () => {
            loadConversations()
            conversations.reset()

            expect(mockManager.reset).toHaveBeenCalled()
        })
    })

    describe('init-time identity config', () => {
        it('should pass through init config to manager construction', () => {
            mockInsights.config.identity_distinct_id = 'user_123'
            mockInsights.config.identity_hash = 'a1b2c3d4'

            loadConversations()

            expect(assignableWindow.__InsightsExtensions__!.initConversations).toHaveBeenCalled()
            expect(mockInsights.config.identity_distinct_id).toBe('user_123')
        })

        it('should not interfere when no identity config is set', () => {
            expect(mockInsights.config.identity_distinct_id).toBeUndefined()

            loadConversations()

            expect(assignableWindow.__InsightsExtensions__!.initConversations).toHaveBeenCalled()
            expect(mockInsights.config.identity_distinct_id).toBeUndefined()
        })
    })
})
