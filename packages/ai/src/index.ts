import PostHogOpenAI from './openai'
import PostHogAzureOpenAI from './openai/azure'
import { wrapVercelLanguageModel } from './vercel/middleware'
import { PostHogSpanProcessor, createPostHogSpanProcessor, captureSpan } from './otel'
import PostHogAnthropic from './anthropic'
import PostHogGoogleGenAI from './gemini'
import { LangChainCallbackHandler } from './langchain/callbacks'
import { Prompts } from './prompts'

export { PostHogOpenAI as OpenAI }
export { PostHogAzureOpenAI as AzureOpenAI }
export { PostHogAnthropic as Anthropic }
export { PostHogGoogleGenAI as GoogleGenAI }
export { wrapVercelLanguageModel as withTracing }
export { PostHogSpanProcessor, createPostHogSpanProcessor, captureSpan }
export { LangChainCallbackHandler }
export { Prompts }

// @hanzo/insights-ai aliases
export { PostHogOpenAI as InsightsOpenAI }
export { PostHogAzureOpenAI as InsightsAzureOpenAI }
export { PostHogAnthropic as InsightsAnthropic }
export { PostHogGoogleGenAI as InsightsGoogleGenAI }
