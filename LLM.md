# insights-js

Hanzo Insights JS — monorepo of analytics SDKs (browser, node, react, react-native,
nextjs, nuxt, ai, convex, mcp) plus a vendored rrweb session-replay stack.

Fork of PostHog's `posthog-js` monorepo, fully rebranded to the Hanzo Insights identity
and published under the `@hanzo/*` npm scope. Canonical repo: `github.com/hanzoinsights/insights-js`.

Provides analytics, feature flags, session replay, and A/B testing for web and Node.js
applications connected to [Hanzo Insights](https://insights.hanzo.ai).

## Package naming (one scheme, no posthog)

- SDKs: `@hanzo/insights` (browser), `@hanzo/insights-core`, `@hanzo/insights-types`,
  `@hanzo/insights-node`, `@hanzo/insights-react`, `@hanzo/insights-react-native`,
  `@hanzo/insights-ai`, `@hanzo/insights-next` (Next.js SDK integration),
  `@hanzo/insights-nextjs` (Next.js build/sourcemap config helper — distinct package),
  `@hanzo/insights-nuxt`, `@hanzo/insights-convex`, `@hanzo/insights-mcp`,
  `@hanzo/insights-lite`, `@hanzo/insights-plugin-utils`,
  `@hanzo/insights-rollup-plugin`, `@hanzo/insights-webpack-plugin`.
- Vendored rrweb stack keeps the `@hanzo/rrweb*` scheme (matches the already-published
  `@hanzo/rrweb*@0.0.47` artifacts + `minimumReleaseAgeExclude` in pnpm-workspace.yaml):
  `@hanzo/rrweb`, `@hanzo/rrweb-types`, `@hanzo/rrweb-snapshot`, `@hanzo/rrweb-utils`,
  `@hanzo/rrdom`, `@hanzo/rrweb-record`, `@hanzo/rrweb-replay`, `@hanzo/rrweb-all`,
  `@hanzo/rrweb-packer`, and the `@hanzo/rrweb-plugin-*` family.
- Tooling: `@hanzo/insights-tooling-*` and `eslint-plugin-insights`.

There must be ZERO `@posthog/*` dependency or identity references in source.
Verify: `grep -rl '@posthog/' packages --include='*.ts' --include='package.json' | grep -v node_modules` → 0.

## Wire protocol — DO NOT rebrand (server contract)

The Insights ingestion server is a posthog-protocol fork and expects the on-the-wire
constants UNCHANGED. Never rename these — they are values, not package identifiers:

- the `window.posthog` global variable name (UMD `output.globals` value),
- `ph_*` cookie / localStorage persistence keys,
- `$`-prefixed event names (`$pageview`, `$identify`, `$autocapture`, `$set`, …),
- `distinct_id`, the `/decide`, `/e/`, `/flags` endpoints,
- the `__PosthogExtensions__` / `__InsightsExtensions__` runtime hook (mixed in the fork).

Package *import specifiers* `posthog-js` / `posthog-node` ARE rebranded to
`@hanzo/insights` / `@hanzo/insights-node` (those are package names, not wire constants).
