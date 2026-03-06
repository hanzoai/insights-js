/// <reference lib="dom" />

import type { Insights } from '@hanzo/insights-node'
import type { CachedPrompt, GetPromptOptions, PromptApiResponse, PromptVariables, PromptsDirectOptions } from './types'

const DEFAULT_CACHE_TTL_SECONDS = 300 // 5 minutes

function isPromptApiResponse(data: unknown): data is PromptApiResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'prompt' in data &&
    typeof (data as PromptApiResponse).prompt === 'string'
  )
}

export interface PromptsWithInsightsOptions {
  insights: Insights
  defaultCacheTtlSeconds?: number
}

export type PromptsOptions = PromptsWithInsightsOptions | PromptsDirectOptions

function isPromptsWithInsights(options: PromptsOptions): options is PromptsWithInsightsOptions {
  return 'insights' in options
}

/**
 * Prompts class for fetching and compiling LLM prompts from Insights
 *
 * @example
 * ```ts
 * // With Insights client
 * const prompts = new Prompts({ insights })
 *
 * // Or with direct options (no Insights client needed)
 * const prompts = new Prompts({
 *   personalApiKey: 'phx_xxx',
 *   projectApiKey: 'phc_xxx',
 *   host: 'https://us.insights.com',
 * })
 *
 * // Fetch with caching and fallback
 * const template = await prompts.get('support-system-prompt', {
 *   cacheTtlSeconds: 300,
 *   fallback: 'You are a helpful assistant.',
 * })
 *
 * // Compile with variables
 * const systemPrompt = prompts.compile(template, {
 *   company: 'Acme Corp',
 *   tier: 'premium',
 * })
 * ```
 */
export class Prompts {
  private personalApiKey: string
  private projectApiKey: string
  private host: string
  private defaultCacheTtlSeconds: number
  private cache: Map<string, CachedPrompt> = new Map()

  constructor(options: PromptsOptions) {
    this.defaultCacheTtlSeconds = options.defaultCacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS

    if (isPromptsWithInsights(options)) {
      this.personalApiKey = options.insights.options.personalApiKey ?? ''
      this.projectApiKey = options.insights.apiKey ?? ''
      this.host = options.insights.host
    } else {
      // Direct options
      this.personalApiKey = options.personalApiKey
      this.projectApiKey = options.projectApiKey
      this.host = options.host ?? 'https://us.insights.com'
    }
  }

  /**
   * Fetch a prompt by name from the Insights API
   *
   * @param name - The name of the prompt to fetch
   * @param options - Optional settings for caching and fallback
   * @returns The prompt string
   * @throws Error if the prompt cannot be fetched and no fallback is provided
   */
  async get(name: string, options?: GetPromptOptions): Promise<string> {
    const cacheTtlSeconds = options?.cacheTtlSeconds ?? this.defaultCacheTtlSeconds
    const fallback = options?.fallback

    // Check cache first
    const cached = this.cache.get(name)
    const now = Date.now()

    if (cached) {
      const isFresh = now - cached.fetchedAt < cacheTtlSeconds * 1000

      if (isFresh) {
        return cached.prompt
      }
    }

    // Try to fetch from API
    try {
      const prompt = await this.fetchPromptFromApi(name)
      const fetchedAt = Date.now()

      // Update cache
      this.cache.set(name, {
        prompt,
        fetchedAt,
      })

      return prompt
    } catch (error) {
      // Fallback order:
      // 1. Return stale cache (with warning)
      if (cached) {
        console.warn(`[Insights Prompts] Failed to fetch prompt "${name}", using stale cache:`, error)
        return cached.prompt
      }

      // 2. Return fallback (with warning)
      if (fallback !== undefined) {
        console.warn(`[Insights Prompts] Failed to fetch prompt "${name}", using fallback:`, error)
        return fallback
      }

      // 3. Throw error
      throw error
    }
  }

  /**
   * Compile a prompt template with variable substitution
   *
   * Variables in the format `{{variableName}}` will be replaced with values from the variables object.
   * Unmatched variables are left unchanged.
   *
   * @param prompt - The prompt template string
   * @param variables - Object containing variable values
   * @returns The compiled prompt string
   */
  compile(prompt: string, variables: PromptVariables): string {
    return prompt.replace(/\{\{([\w.-]+)\}\}/g, (match, variableName) => {
      if (variableName in variables) {
        return String(variables[variableName])
      }

      return match
    })
  }

  /**
   * Clear the cache for a specific prompt or all prompts
   *
   * @param name - Optional prompt name to clear. If not provided, clears all cached prompts.
   */
  clearCache(name?: string): void {
    if (name !== undefined) {
      this.cache.delete(name)
    } else {
      this.cache.clear()
    }
  }

  private async fetchPromptFromApi(name: string): Promise<string> {
    if (!this.personalApiKey) {
      throw new Error(
        '[Insights Prompts] personalApiKey is required to fetch prompts. ' +
          'Please provide it when initializing the Prompts instance.'
      )
    }
    if (!this.projectApiKey) {
      throw new Error(
        '[Insights Prompts] projectApiKey is required to fetch prompts. ' +
          'Please provide it when initializing the Prompts instance.'
      )
    }

    const encodedPromptName = encodeURIComponent(name)
    const encodedProjectApiKey = encodeURIComponent(this.projectApiKey)
    const url = `${this.host}/api/environments/@current/llm_prompts/name/${encodedPromptName}/?token=${encodedProjectApiKey}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.personalApiKey}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`[Insights Prompts] Prompt "${name}" not found`)
      }

      if (response.status === 403) {
        throw new Error(
          `[Insights Prompts] Access denied for prompt "${name}". ` +
            'Check that your personalApiKey has the correct permissions and the LLM prompts feature is enabled.'
        )
      }

      throw new Error(`[Insights Prompts] Failed to fetch prompt "${name}": HTTP ${response.status}`)
    }

    const data: unknown = await response.json()

    if (!isPromptApiResponse(data)) {
      throw new Error(`[Insights Prompts] Invalid response format for prompt "${name}"`)
    }

    return data.prompt
  }
}
