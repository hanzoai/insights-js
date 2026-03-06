# Insights Next.js Config

This package handles sourcemap configuration and upload for the Insights Error Tracking product.

Please see the main [Insights Error Tracking docs](https://insights.hanzo.ai/docs/error-tracking).

## Usage

```typescript
// next.config.ts
import { withInsightsConfig } from '@hanzo/nextjs-config'

const nextConfig = {
  // Your Next.js configuration here
}

export default withInsightsConfig(nextConfig, {
  personalApiKey: process.env.INSIGHTS_PERSONAL_API_KEY!, // Personal API key used for sourcemap uploads, see https://app.insights.hanzo.ai/settings/user-api-keys
  projectId: process.env.INSIGHTS_PROJECT_ID!, // Project ID, see https://app.insights.hanzo.ai/settings/project#variables
  host: process.env.NEXT_PUBLIC_INSIGHTS_HOST!, // (optional) Host URL, defaults to https://us.insights.hanzo.ai
  sourcemaps: {
    // (optional)
    enabled: true, // (optional) Enable sourcemaps generation and upload, default to true on production builds
    releaseName: 'my-application', // (optional) Release name, defaults to repository name
    releaseVersion: '1.0.0', // (optional) Release version, defaults to current git commit
    deleteAfterUpload: true, // (optional) Delete sourcemaps after upload, defaults to true
  },
})
```

## Questions?

### [Check out our community page.](https://insights.hanzo.ai/posts)
