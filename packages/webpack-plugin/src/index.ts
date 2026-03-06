import { Logger, createLogger } from '@hanzo/insights-core'
import { PluginConfig, resolveConfig, ResolvedPluginConfig } from './config'
import webpack from 'webpack'
import { spawnLocal } from '@hanzo/insights-core/process'
import path from 'path'

export * from './config'

export class InsightsWebpackPlugin {
    resolvedConfig: ResolvedPluginConfig
    logger: Logger

    constructor(pluginConfig: PluginConfig) {
        this.logger = createLogger('[Insights Webpack]')
        this.resolvedConfig = resolveConfig(pluginConfig)
        assertValue(
            this.resolvedConfig.personalApiKey,
            `Personal API key not provided. If you are using turbo, make sure to add env variables to your turbo config`
        )
        assertValue(
            this.resolvedConfig.projectId,
            `projectId (or deprecated envId) not provided. If you are using turbo, make sure to add env variables to your turbo config`
        )
    }

    apply(compiler: webpack.Compiler): void {
        new compiler.webpack.SourceMapDevToolPlugin({
            filename: '[file].map',
            noSources: false,
            moduleFilenameTemplate: '[resource-path]',
            append: this.resolvedConfig.sourcemaps.deleteAfterUpload ? false : undefined,
        }).apply(compiler)

        const onDone = async (stats: webpack.Stats, callback: any): Promise<void> => {
            callback = callback || (() => {})
            try {
                await this.processSourceMaps(stats.compilation, this.resolvedConfig)
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : error
                this.logger.error('Error running Insights webpack plugin:', errorMessage)
            }
            return callback()
        }

        if (compiler.hooks) {
            compiler.hooks.done.tapAsync('InsightsWebpackPlugin', onDone)
        } else {
            throw new Error('InsightsWebpackPlugin is not compatible with webpack version < 5')
        }
    }

    async processSourceMaps(compilation: webpack.Compilation, config: ResolvedPluginConfig): Promise<void> {
        const outputDirectory = compilation.outputOptions.path
        const args = []

        // chunks are output outside of the output directory for server chunks
        args.push('sourcemap', 'process')

        const chunkArray = Array.from(compilation.chunks)

        if (chunkArray.length == 0) {
            // No chunks generated, skipping sourcemap processing.
            return
        }

        chunkArray.forEach((chunk) =>
            chunk.files.forEach((file) => {
                const chunkPath = path.resolve(outputDirectory, file)
                args.push('--file', chunkPath)
            })
        )

        if (config.sourcemaps.releaseName) {
            args.push('--release-name', config.sourcemaps.releaseName)
        }

        if (config.sourcemaps.releaseVersion) {
            args.push('--release-version', config.sourcemaps.releaseVersion)
        }

        if (config.sourcemaps.deleteAfterUpload) {
            args.push('--delete-after')
        }

        if (config.sourcemaps.batchSize) {
            args.push('--batch-size', config.sourcemaps.batchSize.toString())
        }

        await spawnLocal(config.cliBinaryPath, args, {
            cwd: process.cwd(),
            env: {
                RUST_LOG: `insights_cli=${config.logLevel}`,
                ...process.env,
                INSIGHTS_CLI_HOST: config.host,
                INSIGHTS_CLI_API_KEY: config.personalApiKey,
                INSIGHTS_CLI_PROJECT_ID: config.projectId,
            },
            stdio: 'inherit',
        })
    }
}

function assertValue(value: any, message: string): void {
    if (!value) {
        throw new Error(message)
    }
}
