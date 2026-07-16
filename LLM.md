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

## ZERO posthog — we own both sides of the wire

There is no PostHog anywhere in this SDK. **We own the ingestion server
(`hanzoai/insights`: Django + `rust/capture` + `nodejs` plugin) AND this SDK**, so
there is no external wire contract to preserve — the wire is ours. The server is
already 100% posthog-free (0 refs in python/rust/node source); this SDK was the
last laggard and is now swept (1452 → 0).

Verify (must stay 0):
`grep -rioE 'posthog' packages/*/src packages/*/tests packages/*/package.json | wc -l`

Renamed with the server, in lockstep — do NOT "restore" any of these:

- `$last_posthog_reset` → **`$last_insights_reset`** — the server's taxonomy
  (`insights/taxonomy/taxonomy.py`, `insights/insightsql/ai.py`) already expected
  the `insights` form; the SDK emitting the `posthog` form was a live MISMATCH.
- `__PosthogExtensions__` → `__InsightsExtensions__` (runtime hook).
- `PostHog`/`posthog`/`POSTHOG` identifiers → `Insights`/`insights`/`INSIGHTS`.
- All hosts → `https://insights.hanzo.ai` (`DEFAULT_PLUGIN_HOST`, `DEFAULT_NUXT_HOST`
  and the core `host` default previously pointed at **PostHog's cloud**
  `us.i.posthog.com` — a real bug). There is no separate assets CDN: remote config
  is fetched from the same host (PostHog's us-assets/eu-assets split was removed).

Still genuinely fixed by convention (not brand): `$`-prefixed event names
(`$pageview`, `$identify`, `$autocapture`, `$set`) and `distinct_id` — these carry
no posthog string and are the event schema the server + ClickHouse read.

### Ingest endpoints are Hanzo-native `/v1/*` (NOT PostHog `/e/`,`/batch/`,`/s/`)

We own the capture server (`hanzoai/insights` `rust/capture`) AND this SDK, so the
event-ingest wire contract is Hanzo `/v1`, not the PostHog paths. Both sides moved
together — do NOT "restore" the old paths:

- events → `POST /v1/e` (single OR batch; was `/e/` + `/batch/`)
- session recordings → `POST /v1/s` (was `/s/`)
- AI/LLM events → `POST /v1/ai` (was `/i/v0/ai`)

Set in `packages/browser/src/insights-core.ts` (`analyticsDefaultEndpoint`),
`packages/core/src/insights-core-stateless.ts` (batch URL), and the replay
`BASE_ENDPOINT`. The capture server serves ONLY these `/v1` paths (legacy removed,
forward-only).

Package *import specifiers* `posthog-js` / `posthog-node` ARE rebranded to
`@hanzo/insights` / `@hanzo/insights-node` (those are package names, not wire constants).
