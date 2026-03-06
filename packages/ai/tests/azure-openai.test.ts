import { Insights } from '@hanzo/insights-node'
import { InsightsAzureOpenAI } from '../src/openai/azure'
import openaiModule from 'openai'

let mockAzureEmbeddingResponse: any = {}

jest.mock('@hanzo/insights-node', () => {
  return {
    Insights: jest.fn().mockImplementation(() => {
      return {
        capture: jest.fn(),
        captureImmediate: jest.fn(),
        privacy_mode: false,
      }
    }),
  }
})

jest.mock('openai', () => {
  // Mock Completions class – `create` is declared on the prototype so that
  // subclasses can safely `super.create(...)` without it being shadowed by an
  // instance field (which would overwrite the subclass implementation).
  class MockCompletions {
    constructor() {}
    create(..._args: any[]): any {
      /* will be stubbed in beforeEach */
      return undefined
    }
  }

  // Mock Chat class
  class MockChat {
    constructor() {}
    static Completions = MockCompletions
  }

  // Mock Responses class with parse method that will be called by super.parse()
  class MockResponses {
    constructor() {}
    // These need to be on the prototype for super.parse() to work
    create() {
      return Promise.resolve({})
    }
    parse() {
      return Promise.resolve({})
    }
  }

  // Mock Embeddings class
  class MockEmbeddings {
    constructor() {}
    create() {
      return Promise.resolve({})
    }
  }

  // Mock AzureOpenAI class
  class MockAzureOpenAI {
    chat: any
    embeddings: any
    responses: any

    constructor() {
      this.chat = {
        completions: {
          create: jest.fn(),
        },
      }
      this.embeddings = {
        create: jest.fn(),
      }
      this.responses = {
        create: jest.fn(),
      }
    }

    static Chat = MockChat
    static Responses = MockResponses
    static Embeddings = MockEmbeddings
  }

  return {
    __esModule: true,
    default: MockAzureOpenAI,
    AzureOpenAI: MockAzureOpenAI,
    Chat: MockChat,
    Responses: MockResponses,
    Embeddings: MockEmbeddings,
  }
})

describe('InsightsAzureOpenAI - Embeddings test suite', () => {
  let mockInsightsClient: Insights
  let client: InsightsAzureOpenAI

  beforeAll(() => {
    if (!process.env.AZURE_OPENAI_API_KEY) {
      console.warn('⚠️ Skipping Azure OpenAI tests: No AZURE_OPENAI_API_KEY environment variable set')
    }
  })

  beforeEach(() => {
    // Skip all tests if no API key is present
    if (!process.env.AZURE_OPENAI_API_KEY) {
      return
    }

    jest.clearAllMocks()

    // Reset the default mocks
    mockInsightsClient = new (Insights as any)()
    client = new InsightsAzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      insights: mockInsightsClient as any,
    })

    // Default embeddings response
    mockAzureEmbeddingResponse = {
      object: 'list',
      data: [
        {
          object: 'embedding',
          embedding: new Array(1536).fill(0).map(() => Math.random()),
          index: 0,
        },
      ],
      model: 'text-embedding-3-small',
      usage: {
        prompt_tokens: 5,
        total_tokens: 5,
      },
    }

    // Mock the Embeddings class
    const EmbeddingsMock: any = openaiModule.Embeddings || class MockEmbeddings {}
    EmbeddingsMock.prototype.create = jest.fn().mockResolvedValue(mockAzureEmbeddingResponse)
  })

  // Conditionally run tests based on API key availability
  const conditionalTest = process.env.AZURE_OPENAI_API_KEY ? test : test.skip

  conditionalTest('basic completion', async () => {
    // Set up mock response for chat completions
    const mockAzureChatResponse = {
      id: 'test-response-id',
      model: 'gpt-4',
      object: 'chat.completion',
      created: Date.now() / 1000,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Hello from Azure OpenAI!',
            refusal: null,
          },
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      },
    }

    const ChatMock: any = openaiModule.Chat
    ;(ChatMock.Completions as any).prototype.create = jest.fn().mockResolvedValue(mockAzureChatResponse)

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      insightsDistinctId: 'test-id',
      insightsProperties: { foo: 'bar' },
    })

    expect(response).toEqual(mockAzureChatResponse)
    expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)

    const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
    const { distinctId, event, properties } = captureArgs[0]

    expect(distinctId).toBe('test-id')
    expect(event).toBe('$ai_generation')
    expect(properties['$ai_provider']).toBe('azure')
    expect(properties['$ai_model']).toBe('gpt-4')
    expect(properties['$ai_input']).toEqual([{ role: 'user', content: 'Hello' }])
    expect(properties['$ai_output_choices']).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello from Azure OpenAI!',
          },
        ],
      },
    ])
    expect(properties['$ai_input_tokens']).toBe(20)
    expect(properties['$ai_output_tokens']).toBe(10)
    expect(properties['$ai_http_status']).toBe(200)
    expect(properties['foo']).toBe('bar')
    expect(typeof properties['$ai_latency']).toBe('number')
  })

  conditionalTest('groups', async () => {
    const mockAzureChatResponse = {
      id: 'test-response-id',
      model: 'gpt-4',
      object: 'chat.completion',
      created: Date.now() / 1000,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Hello!',
            refusal: null,
          },
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      },
    }

    const ChatMock: any = openaiModule.Chat
    ;(ChatMock.Completions as any).prototype.create = jest.fn().mockResolvedValue(mockAzureChatResponse)

    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      insightsDistinctId: 'test-id',
      insightsGroups: { company: 'test_company' },
    })

    expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
    const { groups } = captureArgs[0]
    expect(groups).toEqual({ company: 'test_company' })
  })

  conditionalTest('privacy mode local', async () => {
    const mockAzureChatResponse = {
      id: 'test-response-id',
      model: 'gpt-4',
      object: 'chat.completion',
      created: Date.now() / 1000,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Hello!',
            refusal: null,
          },
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      },
    }

    const ChatMock: any = openaiModule.Chat
    ;(ChatMock.Completions as any).prototype.create = jest.fn().mockResolvedValue(mockAzureChatResponse)

    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      insightsDistinctId: 'test-id',
      insightsPrivacyMode: true,
    })

    expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
    const { properties } = captureArgs[0]
    expect(properties['$ai_input']).toBeNull()
    expect(properties['$ai_output_choices']).toBeNull()
  })

  conditionalTest('privacy mode global', async () => {
    // override mock to appear globally in privacy mode
    ;(mockInsightsClient as any).privacy_mode = true

    const mockAzureChatResponse = {
      id: 'test-response-id',
      model: 'gpt-4',
      object: 'chat.completion',
      created: Date.now() / 1000,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Hello!',
            refusal: null,
          },
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      },
    }

    const ChatMock: any = openaiModule.Chat
    ;(ChatMock.Completions as any).prototype.create = jest.fn().mockResolvedValue(mockAzureChatResponse)

    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      insightsDistinctId: 'test-id',
      // we attempt to override locally, but it should still be null if global is true
      insightsPrivacyMode: false,
    })

    expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
    const { properties } = captureArgs[0]
    expect(properties['$ai_input']).toBeNull()
    expect(properties['$ai_output_choices']).toBeNull()
  })

  conditionalTest('captureImmediate flag', async () => {
    const mockAzureChatResponse = {
      id: 'test-response-id',
      model: 'gpt-4',
      object: 'chat.completion',
      created: Date.now() / 1000,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Hello!',
            refusal: null,
          },
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      },
    }

    const ChatMock: any = openaiModule.Chat
    ;(ChatMock.Completions as any).prototype.create = jest.fn().mockResolvedValue(mockAzureChatResponse)

    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      insightsDistinctId: 'test-id',
      insightsCaptureImmediate: true,
    })

    // captureImmediate should be called once, and capture should not be called
    expect(mockInsightsClient.captureImmediate).toHaveBeenCalledTimes(1)
    expect(mockInsightsClient.capture).toHaveBeenCalledTimes(0)
  })

  conditionalTest('anonymous user - $process_person_profile set to false', async () => {
    const mockAzureChatResponse = {
      id: 'test-response-id',
      model: 'gpt-4',
      object: 'chat.completion',
      created: Date.now() / 1000,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Hello!',
            refusal: null,
          },
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      },
    }

    const ChatMock: any = openaiModule.Chat
    ;(ChatMock.Completions as any).prototype.create = jest.fn().mockResolvedValue(mockAzureChatResponse)

    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      insightsTraceId: 'trace-123',
    })

    expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
    const { distinctId, properties } = captureArgs[0]

    expect(distinctId).toBe('trace-123')
    expect(properties['$process_person_profile']).toBe(false)
  })

  conditionalTest('identified user - $process_person_profile not set', async () => {
    const mockAzureChatResponse = {
      id: 'test-response-id',
      model: 'gpt-4',
      object: 'chat.completion',
      created: Date.now() / 1000,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Hello!',
            refusal: null,
          },
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      },
    }

    const ChatMock: any = openaiModule.Chat
    ;(ChatMock.Completions as any).prototype.create = jest.fn().mockResolvedValue(mockAzureChatResponse)

    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      insightsDistinctId: 'user-456',
      insightsTraceId: 'trace-123',
    })

    expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
    const { distinctId, properties } = captureArgs[0]

    expect(distinctId).toBe('user-456')
    expect(properties['$process_person_profile']).toBeUndefined()
  })

  conditionalTest('system prompt handling', async () => {
    const mockAzureChatResponse = {
      id: 'test-response-id',
      model: 'gpt-4',
      object: 'chat.completion',
      created: Date.now() / 1000,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Paris is the capital of France.',
            refusal: null,
          },
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 25,
        completion_tokens: 8,
        total_tokens: 33,
      },
    }

    const ChatMock: any = openaiModule.Chat
    ;(ChatMock.Completions as any).prototype.create = jest.fn().mockResolvedValue(mockAzureChatResponse)

    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful geography assistant.' },
        { role: 'user', content: 'What is the capital of France?' },
      ],
      insightsDistinctId: 'test-system-prompt',
    })

    expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
    const { distinctId, properties } = captureArgs[0]

    expect(distinctId).toBe('test-system-prompt')
    expect(properties['$ai_input']).toEqual([
      { role: 'system', content: 'You are a helpful geography assistant.' },
      { role: 'user', content: 'What is the capital of France?' },
    ])
    expect(properties['$ai_provider']).toBe('azure')
    expect(properties['$ai_model']).toBe('gpt-4')
  })

  describe('Embeddings', () => {
    conditionalTest('basic embeddings', async () => {
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'Hello world',
        insightsDistinctId: 'test-id',
        insightsProperties: { test: 'embeddings' },
      })

      expect(response).toEqual(mockAzureEmbeddingResponse)
      expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)

      const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
      const { distinctId, event, properties } = captureArgs[0]

      expect(distinctId).toBe('test-id')
      expect(event).toBe('$ai_embedding')
      expect(properties['$ai_provider']).toBe('azure')
      expect(properties['$ai_model']).toBe('text-embedding-3-small')
      expect(properties['$ai_input']).toBe('Hello world')
      expect(properties['$ai_output_choices']).toBeNull() // Embeddings don't have output
      expect(properties['$ai_input_tokens']).toBe(5)
      expect(properties['$ai_output_tokens']).toBeUndefined() // Embeddings don't send output tokens
      expect(properties['$ai_http_status']).toBe(200)
      expect(properties['test']).toBe('embeddings')
      expect(typeof properties['$ai_latency']).toBe('number')
    })

    conditionalTest('embeddings with array input', async () => {
      const arrayInput = ['Hello', 'World', 'Test']
      mockAzureEmbeddingResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: new Array(1536).fill(0).map(() => Math.random()),
            index: 0,
          },
          {
            object: 'embedding',
            embedding: new Array(1536).fill(0).map(() => Math.random()),
            index: 1,
          },
          {
            object: 'embedding',
            embedding: new Array(1536).fill(0).map(() => Math.random()),
            index: 2,
          },
        ],
        model: 'text-embedding-3-small',
        usage: {
          prompt_tokens: 8,
          total_tokens: 8,
        },
      }

      const EmbeddingsMock: any = openaiModule.Embeddings || class MockEmbeddings {}
      EmbeddingsMock.prototype.create = jest.fn().mockResolvedValue(mockAzureEmbeddingResponse)

      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: arrayInput,
        insightsDistinctId: 'test-array-id',
      })

      expect(response).toEqual(mockAzureEmbeddingResponse)
      expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)

      const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
      const { properties } = captureArgs[0]

      expect(properties['$ai_input']).toEqual(arrayInput)
      expect(properties['$ai_output_choices']).toBeNull() // Embeddings don't have output
      expect(properties['$ai_input_tokens']).toBe(8)
      expect(properties['$ai_output_tokens']).toBeUndefined() // Embeddings don't send output tokens
    })

    conditionalTest('embeddings privacy mode', async () => {
      await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'Sensitive data',
        insightsDistinctId: 'test-id',
        insightsPrivacyMode: true,
      })

      expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
      const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
      const { properties } = captureArgs[0]

      expect(properties['$ai_input']).toBeNull()
      expect(properties['$ai_output_choices']).toBeNull()
    })

    conditionalTest('embeddings error handling', async () => {
      const EmbeddingsMock: any = openaiModule.Embeddings || class MockEmbeddings {}
      const testError = new Error('API Error') as Error & { status: number }
      testError.status = 400
      EmbeddingsMock.prototype.create = jest.fn().mockRejectedValue(testError)

      await expect(
        client.embeddings.create({
          model: 'text-embedding-3-small',
          input: 'Test input',
          insightsDistinctId: 'error-user',
        })
      ).rejects.toThrow('API Error')

      // Verify error was captured
      expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
      const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
      const { properties } = captureArgs[0]

      expect(properties['$ai_http_status']).toBe(400)
      expect(properties['$ai_is_error']).toBe(true)
      expect(properties['$ai_error']).toContain('400')
    })

    conditionalTest('embeddings captureImmediate flag', async () => {
      await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'Test input',
        insightsDistinctId: 'test-id',
        insightsCaptureImmediate: true,
      })

      // captureImmediate should be called once, and capture should not be called
      expect(mockInsightsClient.captureImmediate).toHaveBeenCalledTimes(1)
      expect(mockInsightsClient.capture).toHaveBeenCalledTimes(0)
    })

    conditionalTest('embeddings with default trace ID', async () => {
      await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'Test input',
        insightsDistinctId: 'test-id',
      })

      expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
      const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
      const { properties } = captureArgs[0]

      // Should have a generated trace ID
      expect(typeof properties['$ai_trace_id']).toBe('string')
      expect(properties['$ai_trace_id']).toHaveLength(36) // UUID v4 length
    })

    conditionalTest('embeddings with custom trace ID', async () => {
      const customTraceId = 'custom-trace-123'

      await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'Test input',
        insightsDistinctId: 'test-id',
        insightsTraceId: customTraceId,
      })

      expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
      const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
      const { properties } = captureArgs[0]

      expect(properties['$ai_trace_id']).toBe(customTraceId)
    })

    conditionalTest('embeddings with groups', async () => {
      const testGroups = { company: 'acme', team: 'engineering' }

      await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'Test input',
        insightsDistinctId: 'test-id',
        insightsGroups: testGroups,
      })

      expect(mockInsightsClient.capture).toHaveBeenCalledTimes(1)
      const [captureArgs] = (mockInsightsClient.capture as jest.Mock).mock.calls
      const { groups } = captureArgs[0]

      expect(groups).toEqual(testGroups)
    })
  })

  conditionalTest('insightsProperties are not sent to Azure OpenAI', async () => {
    const ChatMock: any = openaiModule.Chat
    const mockCreate = jest.fn().mockResolvedValue({})
    const originalCreate = (ChatMock.Completions as any).prototype.create
    ;(ChatMock.Completions as any).prototype.create = mockCreate

    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [],
      insightsDistinctId: 'test-id',
      insightsProperties: { key: 'value' },
      insightsGroups: { team: 'test' },
      insightsPrivacyMode: true,
      insightsCaptureImmediate: true,
      insightsTraceId: 'trace-123',
    })

    const [actualParams] = mockCreate.mock.calls[0]
    const insightsParams = Object.keys(actualParams).filter((key) => key.startsWith('insights'))
    expect(insightsParams).toEqual([])
    ;(ChatMock.Completions as any).prototype.create = originalCreate
  })
})
