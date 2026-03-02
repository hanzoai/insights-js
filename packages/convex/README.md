<p align="center">
  <img alt="@hanzo/insights-convex" src="https://raw.githubusercontent.com/PostHog/posthog/master/frontend/public/hedgehog/heart-hog.png" width="200">
</p>

<h1 align="center">@hanzo/insights-convex</h1>

<p align="center">
  Hanzo Insights analytics and feature flags for your Convex backend.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@hanzo/insights-convex"><img src="https://badge.fury.io/js/@hanzo%2Finsights-convex.svg" alt="npm version"></a>
</p>

> [!WARNING]
> This package is in alpha and under active development. APIs may change between releases.

## What is this?

The official Hanzo Insights component for [Convex](https://convex.dev). Capture events, identify users, manage groups, and evaluate feature flags — all from your mutations and actions.

## Quick Start

Install the package:

```sh
pnpm add @hanzo/insights-convex
```

Register the component in your `convex/convex.config.ts`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import posthog from "@hanzo/insights-convex/convex.config.js";

const app = defineApp();
app.use(posthog);

export default app;
```

Set your Hanzo Insights API key and host:

```sh
npx convex env set POSTHOG_API_KEY phc_your_project_api_key
npx convex env set POSTHOG_HOST https://us.i.posthog.com
```

Create a `convex/posthog.ts` file to initialize the client:

```ts
// convex/posthog.ts
import { PostHog } from "@hanzo/insights-convex";
import { components } from "./_generated/api";

export const posthog = new PostHog(components.posthog);
```

You can also pass the API key and host explicitly:

```ts
export const posthog = new PostHog(components.posthog, {
  apiKey: "phc_...",
  host: "https://eu.i.posthog.com",
});
```

## Capturing Events

Import `posthog` from your setup file and call methods directly:

```ts
// convex/myFunctions.ts
import { posthog } from "./posthog";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createUser = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", { email: args.email });

    await posthog.capture(ctx, {
      distinctId: userId,
      event: "user_created",
      properties: { email: args.email },
    });

    return userId;
  },
});
```

## Feature Flags

Feature flag methods evaluate flags by calling the Insights API and returning the result. They require an **action** context (they use `ctx.runAction` internally).

See the [example app](../../examples/example-convex/) for a working demo.

## License

MIT
