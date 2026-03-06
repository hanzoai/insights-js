import type { Plugin, OutputOptions, OutputAsset, OutputChunk } from 'rollup'
import { spawnLocal, resolveBinaryPath, LogLevel } from '@hanzo/insights-core/process'
import path from 'node:path'
import fs from 'node:fs/promises'

export interface InsightsRollupPluginOptions {
    personalApiKey: string
    /** @deprecated Use projectId instead */
    envId?: string
    projectId?: string
    host?: string
    cliBinaryPath?: string
    logLevel?: LogLevel
    sourcemaps?: {
        enabled?: boolean
        /** @deprecated Use releaseName instead */
        project?: string
        releaseName?: string
        /** @deprecated Use releaseVersion instead */
        version?: string
        releaseVersion?: string
        deleteAfterUpload?: boolean
        batchSize?: number
    }
}

interface ResolvedInsightsRollupPluginOptions {
    personalApiKey: string
    projectId: string
    host: string
    cliBinaryPath: string
    logLevel: LogLevel
    sourcemaps: {
        enabled: boolean
        releaseName?: string
        releaseVersion?: string
        deleteAfterUpload: boolean
        batchSize?: number
    }
}

export default function insightsRollupPlugin(userOptions: InsightsRollupPluginOptions) {
    const insightsOptions = resolveOptions(userOptions)
    return {
        name: 'insights-rollup-plugin',

        outputOptions: {
            order: 'post',
            handler(options: OutputOptions) {
                return {
                    ...options,
                    sourcemap: insightsOptions.sourcemaps.deleteAfterUpload ? 'hidden' : true,
                }
            },
        },

        writeBundle: {
            // Write bundle is executed in parallel, make it sequential to ensure correct order
            sequential: true,
            async handler(options: OutputOptions, bundle: { [fileName: string]: OutputAsset | OutputChunk }) {
                if (!insightsOptions.sourcemaps.enabled) return
                const args = ['sourcemap', 'process']
                const cliPath = insightsOptions.cliBinaryPath
                const chunks: { [fileName: string]: OutputChunk } = {}
                const basePaths = []

                if (options.dir) {
                    basePaths.push(options.dir)
                }

                if (options.file) {
                    basePaths.push(path.dirname(options.file))
                }

                for (const fileName in bundle) {
                    const chunk = bundle[fileName]
                    const isJsFile = /\.(js|mjs|cjs)$/.test(fileName)
                    if (chunk.type === 'chunk' && isJsFile) {
                        const chunkPath = path.resolve(...basePaths, fileName)
                        chunks[chunkPath] = chunk
                        args.push('--file', chunkPath)
                    }
                }

                if (Object.keys(chunks).length === 0) {
                    console.log(
                        'No chunks found, skipping sourcemap processing for this stage. Your build may be multi-stage and this stage may not be relevant'
                    )
                    return
                }

                if (insightsOptions.sourcemaps.releaseName) {
                    args.push('--release-name', insightsOptions.sourcemaps.releaseName)
                }
                if (insightsOptions.sourcemaps.releaseVersion) {
                    args.push('--release-version', insightsOptions.sourcemaps.releaseVersion)
                }
                if (insightsOptions.sourcemaps.deleteAfterUpload) {
                    args.push('--delete-after')
                }
                if (insightsOptions.sourcemaps.batchSize) {
                    args.push('--batch-size', insightsOptions.sourcemaps.batchSize.toString())
                }
                await spawnLocal(cliPath, args, {
                    env: {
                        ...process.env,
                        RUST_LOG: `insights_cli=${insightsOptions.logLevel}`,
                        INSIGHTS_CLI_HOST: insightsOptions.host,
                        INSIGHTS_CLI_API_KEY: insightsOptions.personalApiKey,
                        INSIGHTS_CLI_PROJECT_ID: insightsOptions.projectId,
                    },
                    stdio: 'inherit',
                    cwd: process.cwd(),
                })

                // we need to update code for others plugins to work
                await Promise.all(
                    Object.entries(chunks).map(([chunkPath, chunk]) =>
                        fs.readFile(chunkPath, 'utf8').then((content) => {
                            chunk.code = content
                        })
                    )
                )
            },
        },
    } as Plugin
}

function resolveOptions(userOptions: InsightsRollupPluginOptions): ResolvedInsightsRollupPluginOptions {
    const projectId = userOptions.projectId ?? userOptions.envId
    if (!projectId) {
        throw new Error('projectId is required (envId is deprecated)')
    } else if (!userOptions.personalApiKey) {
        throw new Error('personalApiKey is required')
    }
    const userSourcemaps = userOptions.sourcemaps ?? {}
    const insightsOptions: ResolvedInsightsRollupPluginOptions = {
        host: userOptions.host || 'https://us.i.insights.com',
        personalApiKey: userOptions.personalApiKey,
        projectId,
        cliBinaryPath:
            userOptions.cliBinaryPath ??
            resolveBinaryPath('insights-cli', {
                path: process.env.PATH ?? '',
                cwd: process.cwd(),
            }),
        logLevel: userOptions.logLevel ?? 'info',
        sourcemaps: {
            enabled: userSourcemaps.enabled ?? true,
            deleteAfterUpload: userSourcemaps.deleteAfterUpload ?? true,
            batchSize: userSourcemaps.batchSize,
            releaseName: userSourcemaps.releaseName ?? userSourcemaps.project,
            releaseVersion: userSourcemaps.releaseVersion ?? userSourcemaps.version,
        },
    }
    return insightsOptions
}
