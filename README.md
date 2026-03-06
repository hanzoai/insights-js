# Hanzo Insights JS

Hanzo Insights JS SDK — fork of [@hanzo/insights](https://github.com/hanzoai/@hanzo/insights).

Provides analytics, feature flags, session replay, and A/B testing for web and Node.js applications connected to [Hanzo Insights](https://insights.hanzo.ai).

## Packages

| Package | Description |
|---------|-------------|
| [`@hanzo/insights`](packages/browser) | Browser SDK (analytics, session replay, feature flags) |
| [`@hanzo/insights-node`](packages/node) | Node.js SDK |
| [`@hanzo/insights-react`](packages/react) | React hooks (`useInsights`, `InsightsProvider`) |
| [`@hanzo/insights-react-native`](packages/react-native) | React Native SDK |
| [`@hanzo/insights-ai`](packages/ai) | AI/LLM observability |
| [`@hanzo/insights-core`](packages/core) | Core shared logic |
| [`@hanzo/insights-types`](packages/types) | TypeScript types |
| [`@hanzo/insights-lite`](packages/web) | Lightweight browser SDK |
| [`@hanzo/insights-nuxt`](packages/nuxt) | Nuxt.js module |
| [`@hanzo/insights-nextjs`](packages/nextjs-config) | Next.js configuration helper |
| [`@hanzo/insights-rollup-plugin`](packages/rollup-plugin) | Rollup plugin |
| [`@hanzo/insights-webpack-plugin`](packages/webpack-plugin) | Webpack plugin |
| [`@hanzo/insights-convex`](packages/convex) | Convex backend analytics |

## Quick Start

```ts
import { Insights } from '@hanzo/insights'

const insights = new Insights('YOUR_API_KEY', {
  api_host: 'https://insights.hanzo.ai'
})

insights.capture('user_signed_up', { plan: 'pro' })
```

## Upstream

This is a branded fork of [Insights/@hanzo/insights](https://github.com/hanzoai/@hanzo/insights).
The `Insights` class is an alias for `Insights` — all Insights APIs work unchanged.

To sync upstream changes:

```bash
git remote add upstream https://github.com/hanzoai/@hanzo/insights.git
git fetch upstream
git merge upstream/main
```
