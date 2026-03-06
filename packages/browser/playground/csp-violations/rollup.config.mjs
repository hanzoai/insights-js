import 'dotenv/config'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'

const prod = process.env.NODE_ENV === 'production'

export default {
    input: {
        insights: 'src/insights.js',
        main: 'src/main.js',
    },
    output: {
        dir: 'dist',
        sourcemap: !prod,
    },
    plugins: [
        replace({
            preventAssignment: true,
            'process.env.INSIGHTS_PROJECT_API_KEY': JSON.stringify(process.env.INSIGHTS_PROJECT_API_KEY),
            'process.env.INSIGHTS_API_HOST': JSON.stringify(process.env.INSIGHTS_API_HOST),
            'process.env.INSIGHTS_UI_HOST': JSON.stringify(process.env.INSIGHTS_UI_HOST),
        }),
        resolve(),
        commonjs(),
    ],
}
