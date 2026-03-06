import nextPackage from 'next/package.json' with { type: 'json' }
import semver from 'semver'

import { spawnLocal } from '@hanzo/insights-core/process'
import { ResolvedPluginConfig } from '@hanzo/insights-webpack-plugin'

export function getNextJsVersion(): string {
  return nextPackage.version
}

export function hasCompilerHook(): boolean {
  const nextJsVersion = getNextJsVersion()
  return semver.gte(nextJsVersion, '15.4.1')
}

export async function processSourceMaps(insightsOptions: ResolvedPluginConfig, directory: string) {
  const cliOptions = []
  cliOptions.push('sourcemap', 'process')
  cliOptions.push('--directory', directory)

  if (insightsOptions.sourcemaps.releaseName) {
    cliOptions.push('--release-name', insightsOptions.sourcemaps.releaseName)
  }

  if (insightsOptions.sourcemaps.releaseVersion) {
    cliOptions.push('--release-version', insightsOptions.sourcemaps.releaseVersion)
  }

  if (insightsOptions.sourcemaps.deleteAfterUpload) {
    cliOptions.push('--delete-after')
  }

  if (insightsOptions.sourcemaps.batchSize) {
    cliOptions.push('--batch-size', insightsOptions.sourcemaps.batchSize.toString())
  }

  const logLevel = `insights_cli=${insightsOptions.logLevel}`
  // Add env variables
  const envVars = {
    ...process.env,
    RUST_LOG: logLevel,
    INSIGHTS_CLI_HOST: insightsOptions.host,
    INSIGHTS_CLI_API_KEY: insightsOptions.personalApiKey,
    INSIGHTS_CLI_PROJECT_ID: insightsOptions.projectId,
  }
  await callInsightsCli(insightsOptions.cliBinaryPath, cliOptions, envVars)
}

async function callInsightsCli(binaryPath: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  await spawnLocal(binaryPath, args, {
    env,
    stdio: 'inherit',
    cwd: process.cwd(),
  })
}

// Helper to detect if Turbopack is enabled
export function isTurbopackEnabled(): boolean {
  // CLI flag (--turbo/--turbopack) injects TURBOPACK=1 at runtime
  return process.env.TURBOPACK === '1' || (isTurbopackDefault() && !(process.env.WEBPACK === '1'))
}

function isTurbopackDefault(): boolean {
  const nextJsVersion = getNextJsVersion()
  return semver.gte(nextJsVersion, '16.0.0')
}
