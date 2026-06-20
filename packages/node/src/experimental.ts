/**
 * Deprecated experimental APIs.
 *
 * @packageDocumentation
 * @deprecated Use `import type { FlagDefinitionCacheData, FlagDefinitionCacheProvider } from '@hanzo/insights-node'` instead.
 */

const postHogNodeExperimentalDeprecationWarning =
  "[Insights] `insights-node/experimental` is deprecated. Use `import type { FlagDefinitionCacheData, FlagDefinitionCacheProvider } from '@hanzo/insights-node'` instead."

// eslint-disable-next-line no-console
console.warn(postHogNodeExperimentalDeprecationWarning)

export type { FlagDefinitionCacheProvider, FlagDefinitionCacheData } from './extensions/feature-flags/cache'
