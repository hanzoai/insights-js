#!/usr/bin/env bash
# Decomplected posthog -> hanzo/insights rebrand.
# LAYER 1 (package identity) + LAYER 2 (cross-package import specifiers).
# LAYER 4 wire-protocol constants (ph_*, $pageview, distinct_id, /decide, /e/,
# __PosthogExtensions__, the window.posthog global var VALUE) are PRESERVED.
#
# One source of truth: the SPEC array below. Ordered longest-first so that
# e.g. @posthog/rrweb-plugin-console-record is rewritten before @posthog/rrweb.
set -euo pipefail
cd "$(dirname "$0")/.."

# Files in scope: workspace + examples + playground source/config, NOT:
#   node_modules, dist, build artifacts, *.lock, the immutable references/ JSON
#   snapshots (generated API docs that pin old published ids), CHANGELOG.md
#   (historical record), pnpm-lock.yaml.
mapfile -t FILES < <(
  find packages tooling examples playground \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
       -o -name '*.mjs' -o -name '*.cjs' -o -name '*.json' -o -name '*.vue' \) \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/.turbo/*' \
    -not -path '*/references/*' \
    -not -name 'pnpm-lock.yaml' \
    -not -name 'CHANGELOG.md'
)
echo "Files in scope: ${#FILES[@]}"

# ---- SPEC: @posthog/<x>  ->  <hanzo equivalent>  (ORDERED, longest first) ----
# rrweb family keeps the published @hanzo/rrweb* scheme (already on npm @0.0.47,
# already imported by packages/browser, already in minimumReleaseAgeExclude).
declare -a SPEC=(
  # rrweb plugins (longest)
  "@posthog/rrweb-plugin-canvas-webrtc-record=@hanzo/rrweb-plugin-canvas-webrtc-record"
  "@posthog/rrweb-plugin-canvas-webrtc-replay=@hanzo/rrweb-plugin-canvas-webrtc-replay"
  "@posthog/rrweb-plugin-sequential-id-record=@hanzo/rrweb-plugin-sequential-id-record"
  "@posthog/rrweb-plugin-sequential-id-replay=@hanzo/rrweb-plugin-sequential-id-replay"
  "@posthog/rrweb-plugin-console-record=@hanzo/rrweb-plugin-console-record"
  "@posthog/rrweb-plugin-console-replay=@hanzo/rrweb-plugin-console-replay"
  # rrweb core family
  "@posthog/rrweb-snapshot=@hanzo/rrweb-snapshot"
  "@posthog/rrweb-record=@hanzo/rrweb-record"
  "@posthog/rrweb-replay=@hanzo/rrweb-replay"
  "@posthog/rrweb-packer=@hanzo/rrweb-packer"
  "@posthog/rrweb-types=@hanzo/rrweb-types"
  "@posthog/rrweb-utils=@hanzo/rrweb-utils"
  "@posthog/rrweb-all=@hanzo/rrweb-all"
  "@posthog/rrweb=@hanzo/rrweb"
  "@posthog/rrdom=@hanzo/rrdom"
  # SDK family -> @hanzo/insights*
  "@posthog/nextjs-config=@hanzo/insights-nextjs"
  "@posthog/plugin-utils=@hanzo/insights-plugin-utils"
  "@posthog/webpack-plugin=@hanzo/insights-webpack-plugin"
  "@posthog/react-slim=@hanzo/react-slim"
  "@posthog/core=@hanzo/insights-core"
  "@posthog/types=@hanzo/insights-types"
  "@posthog/next=@hanzo/insights-next"
  "@posthog/react=@hanzo/insights-react"
  "@posthog/mcp=@hanzo/insights-mcp"
  "@posthog/convex=@hanzo/insights-convex"
  "@posthog/ai=@hanzo/insights-ai"
  # tooling scope
  "@posthog-tooling/tsconfig-base=@hanzo/insights-tooling-tsconfig-base"
  "@posthog-tooling/release=@hanzo/insights-tooling-release"
)

# Apply @posthog/* spec with word-boundary on the right so prefixes are safe
# (we ordered longest-first, but also require a non [A-Za-z0-9_-] char after).
# from/to passed via env to keep '/' out of the regex literal; use \Q..\E quoting
# and a non-slash delimiter is unnecessary since we anchor via env vars.
for pair in "${SPEC[@]}"; do
  PH_FROM="${pair%%=*}" PH_TO="${pair##*=}" \
    perl -0pi -e 's/\Q$ENV{PH_FROM}\E(?![A-Za-z0-9_-])/$ENV{PH_TO}/g' "${FILES[@]}"
done

# ---- bare module specifiers (quoted) posthog-js / posthog-node ----
# These are PACKAGE imports (LAYER 2): the browser SDK package is @hanzo/insights,
# the node SDK is @hanzo/insights-node. Only rewrite the QUOTED specifier and the
# package.json dependency KEY, never the bare word 'posthog' (the wire global) or
# identifiers like posthogJs/PostHog. The quote char is preserved on both sides so
# a UMD globals map like 'posthog-js': 'posthog' keeps its VALUE 'posthog'.
perl -0pi -e 's/(["\x27])posthog-js\1/$1\@hanzo\/insights$1/g' "${FILES[@]}"
perl -0pi -e 's/(["\x27])posthog-node\b/$1\@hanzo\/insights-node/g' "${FILES[@]}"

echo "Specifier rewrite pass complete."
