# Example app — `@insights/convex`

Exercises every method the component exposes — analytics, local feature flag eval, remote feature
flag eval, and AI generation tracing — against a real Insights project. Useful for verifying
changes to the component end-to-end and as a runnable reference for setup.

## Running it

From the repository root:

```sh
pnpm i
pnpm package        # builds the tarball that this app installs
pnpm dev --filter example-convex
```

In a second terminal:

```sh
cd examples/example-convex
npx convex dev
npx convex env set INSIGHTS_PROJECT_TOKEN phc_…             # project token
npx convex env set INSIGHTS_PERSONAL_API_KEY phs_…  # optional, enables local eval
npx convex env set INSIGHTS_HOST https://us.i.insights.com   # optional, US default
```

## What you'll see

- **Sections 01–03** capture analytics events (verify them in your Insights activity feed).
- **Section 04** has two rows of buttons — local-eval methods (query context, reactive) and
  remote-eval methods (action context, per-call `/flags` request).
- **Section 05** captures `$ai_generation` events through `@insights/ai`, defaulting to
  OpenTelemetry with manual capture as the alternative. See
  [LLM analytics for Convex](https://insights.hanzo.ai/docs/llm-analytics/installation/convex).
- The right column shows the local evaluation cache state plus a live, reactive view of flag
  values for the current Distinct ID — change a flag in Insights and the row flashes when the cron
  picks it up.
