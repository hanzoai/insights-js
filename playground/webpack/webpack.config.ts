import path from 'node:path'
import webpack from 'webpack'
import { InsightsWebpackPlugin } from '@insights/webpack-plugin'
import packageJson from './package.json'

const config: webpack.Configuration = {
    mode: 'production',
    entry: './src/index.ts',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
        new InsightsWebpackPlugin({
            personalApiKey: process.env.INSIGHTS_PERSONAL_API_KEY,
            projectId: process.env.INSIGHTS_PROJECT_ID,
            host: process.env.INSIGHTS_API_HOST,
            logLevel: 'error',
            cliBinaryPath: process.env.INSIGHTS_CLI_PATH,
            sourcemaps: {
                enabled: true,
                releaseName: packageJson.name,
                releaseVersion: packageJson.version,
                deleteAfterUpload: true,
            },
        }),
    ],
}

export default config
