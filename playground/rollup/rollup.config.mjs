import insights from '@insights/rollup-plugin'
import packageJson from './package.json' with { type: 'json' }

export default {
    input: './src/index.ts',
    output: [
        {
            format: 'es',
            dir: 'dist/esm',
        },
        {
            format: 'cjs',
            dir: 'dist/cjs',
        },
        {
            format: 'iife',
            file: 'dist/index.iife.js',
        },
    ],
    plugins: [
        insights({
            personalApiKey: process.env.INSIGHTS_PERSONAL_API_KEY,
            projectId: process.env.INSIGHTS_PROJECT_ID,
            host: process.env.INSIGHTS_API_HOST,
            cliBinaryPath: process.env.INSIGHTS_CLI_BINARY_PATH,
            logLevel: 'info',
            sourcemaps: {
                enabled: true,
            },
        }),
    ],
}
