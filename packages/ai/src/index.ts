import InsightsOpenAI from './openai'
import InsightsAzureOpenAI from './openai/azure'
import { wrapVercelLanguageModel } from './vercel/middleware'
import { InsightsSpanProcessor, createInsightsSpanProcessor, captureSpan } from './otel'
import InsightsAnthropic from './anthropic'
import InsightsGoogleGenAI from './gemini'
import { LangChainCallbackHandler } from './langchain/callbacks'
import { Prompts } from './prompts'

export { InsightsOpenAI as OpenAI }
export { InsightsAzureOpenAI as AzureOpenAI }
export { InsightsAnthropic as Anthropic }
export { InsightsGoogleGenAI as GoogleGenAI }
export { wrapVercelLanguageModel as withTracing }
export { InsightsSpanProcessor, createInsightsSpanProcessor, captureSpan }
export { LangChainCallbackHandler }
export { Prompts }

// @hanzo/insights-ai aliases
export { InsightsOpenAI as InsightsOpenAI }
export { InsightsAzureOpenAI as InsightsAzureOpenAI }
export { InsightsAnthropic as InsightsAnthropic }
export { InsightsGoogleGenAI as InsightsGoogleGenAI }
