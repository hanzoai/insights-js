# insights-js

Hanzo Insights JS — monorepo of analytics SDKs (browser, node, react, react-native,
nextjs, nuxt, ai, convex, mcp) plus a vendored rrweb session-replay stack.

Hanzo-native end to end, published under the `@hanzo/*` npm scope. Originally
derived from an upstream OSS analytics SDK (see `LICENSE` for attribution); no
upstream brand remains in this codebase — see "ZERO upstream brand" below.

Provides analytics, feature flags, session replay, and A/B testing for web and Node.js
applications connected to [Hanzo Insights](https://insights.hanzo.ai).

## Package naming (one scheme)

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

## ZERO upstream brand — we own both sides of the wire

This codebase is Hanzo-native end to end. **We own the ingestion server
(`hanzoai/insights`: Django + `rust/capture` + `nodejs` plugin) AND this SDK**, so
there is no external wire contract to preserve — the wire is ours. Anyone tempted
to "restore" an upstream constant for compatibility: there is nothing to be
compatible with. Both sides move together.

**Enforced by CI**, not by convention: `.github/workflows/brand-guard.yml` fails on
any upstream-brand reference or filename, anywhere in the repo (excluding
`node_modules`, generated `dist`/`lib`/`references`, and the guard itself — a
guard must name what it forbids, so that ONE file is the only place the string may
appear; never run a rebrand sweep across it).

Settled during the sweep (1452 refs → 0), keep them settled:

- **Event property**: the reset property is `$last_insights_reset`. The server
  taxonomy (`insights/taxonomy/taxonomy.py`, `insights/insightsql/ai.py`) always
  expected this form — the SDK previously emitted the upstream form, which was a
  live MISMATCH silently dropping the property.
- **Runtime hook**: `__InsightsExtensions__`.
- **Hosts**: everything defaults to `https://insights.hanzo.ai`.
  `DEFAULT_PLUGIN_HOST`, `DEFAULT_NUXT_HOST` and the core `host` default used to
  point at the *upstream vendor's cloud* — a real bug, since it sent our users'
  events to a third party. There is NO separate assets CDN: remote config is
  fetched from the same host (the upstream us-assets/eu-assets split was removed;
  it had degenerated into `if (x === A) x = A`).
- **Generated output**: `references/` is gitignored (`pnpm generate-references`
  regenerates it); 58MB of snapshots named for upstream versions we never shipped
  were dropped.

NOT brand, do not touch: `$`-prefixed event names (`$pageview`, `$identify`,
`$autocapture`, `$set`) and `distinct_id` — that's the event schema the server and
ClickHouse read.

### Ingest endpoints are Hanzo-native `/v1/*`

We own the capture server (`hanzoai/insights` `rust/capture`) AND this SDK, so the
event-ingest wire contract is Hanzo `/v1`, not the upstream paths. Both sides moved
together — do NOT "restore" the old paths:

- events → `POST /v1/e` (single OR batch; was `/e/` + `/batch/`)
- session recordings → `POST /v1/s` (was `/s/`)
- AI/LLM events → `POST /v1/ai` (was `/i/v0/ai`)

Set in `packages/browser/src/insights-core.ts` (`analyticsDefaultEndpoint`),
`packages/core/src/insights-core-stateless.ts` (batch URL), and the replay
`BASE_ENDPOINT`. The capture server serves ONLY these `/v1` paths (legacy removed,
forward-only).

Import specifiers are `@hanzo/insights` / `@hanzo/insights-node` — package names,
not wire constants.

## LICENSE / NOTICE are exempt — never rebrand attribution

`LICENSE` and `NOTICE` name the real upstream copyright holders and the real
upstream repo URL — read them there; they are the source of truth and must stay
verbatim. Apache-2.0 section 4(c) requires retaining those notices, and rewriting
a third party's copyright line falsifies who owns the work. An earlier rebrand
pass did exactly that (it renamed the copyright holder and invented a
non-existent upstream URL); both were restored, and the two files are excluded
from the brand guard. The rebrand covers OUR identity, package names, and code —
never someone else's copyright.
