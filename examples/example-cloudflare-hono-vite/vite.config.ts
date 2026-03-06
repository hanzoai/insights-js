import { cloudflare } from '@cloudflare/vite-plugin'
import insights from '@insights/rollup-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [
        cloudflare(),
        insights({
            personalApiKey: process.env.INSIGHTS_PERSONAL_API_KEY!,
            projectId: process.env.INSIGHTS_PROJECT_ID!,
            host: process.env.INSIGHTS_API_HOST,
            sourcemaps: {
                enabled: true,
                deleteAfterUpload: false,
            },
        }),
    ],
})
