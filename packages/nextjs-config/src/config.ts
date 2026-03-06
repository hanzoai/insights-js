import type { NextConfig } from 'next'
import { InsightsWebpackPlugin, PluginConfig, resolveConfig, ResolvedPluginConfig } from '@hanzo/insights-webpack-plugin'
import { hasCompilerHook, isTurbopackEnabled, processSourceMaps } from './utils'

type NextFuncConfig = (phase: string, { defaultConfig }: { defaultConfig: NextConfig }) => NextConfig
type NextAsyncConfig = (phase: string, { defaultConfig }: { defaultConfig: NextConfig }) => Promise<NextConfig>
type UserProvidedConfig = NextConfig | NextFuncConfig | NextAsyncConfig

export function withInsightsConfig(userNextConfig: UserProvidedConfig, insightsConfig: PluginConfig): NextConfig {
  const resolvedConfig = resolveConfig(insightsConfig)
  const sourceMapEnabled = resolvedConfig.sourcemaps.enabled
  const isCompilerHookSupported = hasCompilerHook()
  const turbopackEnabled = isTurbopackEnabled()
  if (turbopackEnabled && !isCompilerHookSupported) {
    console.warn('[@insights/nextjs-config] Turbopack support is only available with next version >= 15.4.1')
  }
  return async (phase: string, { defaultConfig }: { defaultConfig: NextConfig }) => {
    const {
      webpack: userWebPackConfig,
      compiler: userCompilerConfig,
      distDir,
      ...userConfig
    } = await resolveUserConfig(userNextConfig, phase, defaultConfig)
    const nextConfig = {
      ...userConfig,
      distDir,
      webpack: withWebpackConfig(userWebPackConfig, resolvedConfig),
      compiler: withCompilerConfig(userCompilerConfig, resolvedConfig),
    }
    if (turbopackEnabled && sourceMapEnabled) {
      nextConfig.productionBrowserSourceMaps = true
    }
    return nextConfig
  }
}

function resolveUserConfig(
  userNextConfig: UserProvidedConfig,
  phase: string,
  defaultConfig: NextConfig
): Promise<NextConfig> {
  if (typeof userNextConfig === 'function') {
    const maybePromise = userNextConfig(phase, { defaultConfig })
    if (maybePromise instanceof Promise) {
      return maybePromise
    } else {
      return Promise.resolve(maybePromise)
    }
  } else if (typeof userNextConfig === 'object') {
    return Promise.resolve(userNextConfig)
  } else {
    throw new Error('Invalid user config')
  }
}

function withWebpackConfig(userWebpackConfig: NextConfig['webpack'], insightsConfig: ResolvedPluginConfig) {
  const defaultWebpackConfig = userWebpackConfig || ((config: any) => config)
  const sourceMapEnabled = insightsConfig.sourcemaps.enabled
  const turbopackEnabled = isTurbopackEnabled()
  return (config: any, options: any) => {
    const webpackConfig = defaultWebpackConfig(config, options)
    const isServer = options.isServer
    if (sourceMapEnabled) {
      if (!turbopackEnabled) {
        webpackConfig.plugins = webpackConfig.plugins || []
        let currentConfig = insightsConfig
        if (isServer) {
          currentConfig = {
            ...insightsConfig,
            sourcemaps: {
              ...insightsConfig.sourcemaps,
              deleteAfterUpload: false,
            },
          }
        }
        webpackConfig.plugins.push(new InsightsWebpackPlugin(currentConfig))
      }
    }
    return webpackConfig
  }
}

function withCompilerConfig(
  userCompilerConfig: NextConfig['compiler'],
  insightsConfig: ResolvedPluginConfig
): NextConfig['compiler'] {
  const sourceMapEnabled = insightsConfig.sourcemaps.enabled
  const turbopackEnabled = isTurbopackEnabled()
  if (sourceMapEnabled && turbopackEnabled && hasCompilerHook()) {
    const newConfig = userCompilerConfig || {}
    const userCompilerHook = userCompilerConfig?.runAfterProductionCompile
    newConfig.runAfterProductionCompile = async (config: { distDir: string; projectDir: string }) => {
      await userCompilerHook?.(config)
      console.debug('Processing source maps from compilation hook...')
      await processSourceMaps(insightsConfig, config.distDir)
    }
    return newConfig
  }
  return userCompilerConfig
}
