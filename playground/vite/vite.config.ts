/* eslint-env node */
import insights from '@insights/rollup-plugin'
import { defineConfig } from 'vite'
//@ts-ignore
import sri from 'vite-plugin-sri'

export default defineConfig({
    plugins: [
        insights({
            personalApiKey: process.env.INSIGHTS_PERSONAL_API_KEY!,
            projectId: process.env.INSIGHTS_PROJECT_ID!,
            host: process.env.INSIGHTS_API_HOST,
            sourcemaps: {
                enabled: true,
                deleteAfterUpload: false,
            },
        }),
        sri(),
    ],
})
