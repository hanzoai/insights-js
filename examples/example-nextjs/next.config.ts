/* eslint-env node */

import { withInsightsConfig } from '@insights/nextjs-config'
import packageJson from './package.json' with { type: 'json' }

const nextConfig = {
    /* config options here */
}

export default withInsightsConfig(nextConfig, {
    personalApiKey: process.env.INSIGHTS_PERSONAL_API_KEY!,
    projectId: process.env.INSIGHTS_PROJECT_ID!,
    host: process.env.NEXT_PUBLIC_INSIGHTS_API_HOST,
    cliBinaryPath: process.env.INSIGHTS_CLI_PATH, // Optional
    logLevel: 'debug',
    sourcemaps: {
        releaseName: 'example-nextjs',
        releaseVersion: packageJson.version,
        deleteAfterUpload: true,
        batchSize: 50, // Optional. Default to 50
    },
})
