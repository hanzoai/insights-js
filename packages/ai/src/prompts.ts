/// <reference lib="dom" />

import type { Insights } from '@hanzo/insights-node'
import type { CachedPrompt, GetPromptOptions, PromptApiResponse, PromptVariables, PromptsDirectOptions } from './types'

const DEFAULT_CACHE_TTL_SECONDS = 300 // 5 minutes
const DEFAULT_PROMPTS_HOST = 'https://us.posthog.com'
type PromptVersionCache = Map<number | undefined, CachedPrompt>

function normalizeApiKey(value?: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeHost(value?: unknown): string {
  const normalizedHost = typeof value === 'string' ? value.trim() : ''
  return (normalizedHost || DEFAULT_PROMPTS_HOST).replace(/\/+$/, '')
}

function isPromptApiResponse(data: unknown): data is PromptApiResponse {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const record = data as Record<string, unknown>
  return typeof record.prompt === 'string' && typeof record.name === 'string' && typeof record.version === 'number'
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
 * // Or fetch an exact published version
 * const v3Template = await prompts.get('support-system-prompt', {
 *   version: 3,
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
  private cache: Map<string, PromptVersionCache> = new Map()
  private hasWarnedDeprecation = false

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
  private async getInternal(name: string, options?: GetPromptOptions): Promise<PromptRemoteResult> {
    const cacheTtlSeconds = options?.cacheTtlSeconds ?? this.defaultCacheTtlSeconds
    const version = options?.version
    const promptLabel = this.getPromptLabel(name, version)

    // Check cache first
    const cached = this.getPromptCache(name)?.get(version)
    const now = Date.now()

    if (cached) {
      const isFresh = now - cached.fetchedAt < cacheTtlSeconds * 1000

      if (isFresh) {
        const { fetchedAt: _, ...cachedResult } = cached
        return { source: 'cache', ...cachedResult }
      }
    }

    // Try to fetch from API
    try {
      const fetched = await this.fetchPromptFromApi(name, version)

      // Update cache
      this.getOrCreatePromptCache(name).set(version, { ...fetched, fetchedAt: Date.now() })

      return { source: 'api', ...fetched }
    } catch (error) {
      // Return stale cache (with warning)
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
   * @param name - Optional prompt name to clear. If provided, clears all cached versions for that prompt unless a version is also provided.
   * @param version - Optional prompt version to clear. Requires a prompt name.
   */
  clearCache(name?: string, version?: number): void {
    if (version !== undefined && name === undefined) {
      throw new Error("'version' requires 'name' to be provided")
    }

    if (name === undefined) {
      this.cache.clear()
      return
    }

    if (version === undefined) {
      this.cache.delete(name)
      return
    }

    const promptVersions = this.getPromptCache(name)
    promptVersions?.delete(version)

    if (promptVersions?.size === 0) {
      this.cache.delete(name)
    }
  }

  private async fetchPromptFromApi(name: string, version?: number): Promise<Omit<PromptRemoteResult, 'source'>> {
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
    const versionQuery = version === undefined ? '' : `&version=${encodeURIComponent(String(version))}`
    const promptLabel = this.getPromptLabel(name, version)
    const url = `${this.host}/api/environments/@current/llm_prompts/name/${encodedPromptName}/?token=${encodedProjectApiKey}${versionQuery}`

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

    return { prompt: data.prompt, name: data.name, version: data.version }
  }
}
