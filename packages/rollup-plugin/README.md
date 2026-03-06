# @hanzo/rollup-plugin

Rollup plugin for uploading source maps to Insights for error tracking.

[SEE FULL DOCS](https://insights.hanzo.ai/docs/error-tracking/upload-source-maps/rollup)

## Installation

```bash
npm install @hanzo/rollup-plugin --save-dev
```

## Usage

Add the plugin to your Rollup configuration:

```javascript
import insights from '@hanzo/rollup-plugin'

export default {
    input: './src/index.ts',
    output: {
        format: 'es',
        dir: 'dist',
    },
    plugins: [
        insights({
            personalApiKey: process.env.INSIGHTS_PERSONAL_API_KEY,
            projectId: process.env.INSIGHTS_PROJECT_ID,
            sourcemaps: {
                enabled: true,
                releaseName: 'my-app',
                releaseVersion: '1.0.0',
            },
        }),
    ],
}
```

### Configuration Options

| Option                         | Type                                                 | Required | Default                    | Description                                 |
| ------------------------------ | ---------------------------------------------------- | -------- | -------------------------- | ------------------------------------------- |
| `personalApiKey`               | `string`                                             | Yes      | -                          | Your Insights personal API key               |
| `projectId`                    | `string`                                             | Yes      | -                          | Your Insights project/environment ID         |
| `envId`                        | `string`                                             | No       | -                          | Deprecated alias for `projectId`            |
| `host`                         | `string`                                             | No       | `https://us.i.insights.hanzo.ai` | Insights instance host                       |
| `logLevel`                     | `'debug' \| 'info' \| 'warn' \| 'error' \| 'silent'` | No       | `'info'`                   | Logging verbosity                           |
| `cliBinaryPath`                | `string`                                             | No       | Auto-detected              | Path to the Insights CLI binary              |
| `sourcemaps.enabled`           | `boolean`                                            | No       | `true`                     | Enable source map processing                |
| `sourcemaps.releaseName`       | `string`                                             | No       | -                          | Release name for source map grouping        |
| `sourcemaps.releaseVersion`    | `string`                                             | No       | -                          | Version identifier for the release          |
| `sourcemaps.deleteAfterUpload` | `boolean`                                            | No       | `true`                     | Delete source maps after upload             |
| `sourcemaps.batchSize`         | `number`                                             | No       | -                          | Number of source maps to upload in parallel |

### Full Example

```javascript
import insights from '@hanzo/rollup-plugin'
import packageJson from './package.json' with { type: 'json' }

export default {
    input: './src/index.ts',
    output: [
        {
            format: 'es',
            dir: 'dist/esm',
        },
    ],
    plugins: [
        insights({
            personalApiKey: process.env.INSIGHTS_PERSONAL_API_KEY,
            projectId: process.env.INSIGHTS_PROJECT_ID,
            host: process.env.INSIGHTS_API_HOST,
            logLevel: 'info',
            sourcemaps: {
                enabled: true,
                releaseName: packageJson.name,
                releaseVersion: packageJson.version,
            },
        }),
    ],
}
```

## Questions?

### [Check out our community page.](https://insights.hanzo.ai/docs/error-tracking/upload-source-maps/rollup)
