# @insights/next Usage Guide

Comprehensive reference for every feature in the `@insights/next` package.

## Table of Contents

- [App Router Setup](#app-router-setup)
    - [Environment Variables](#environment-variables)
    - [Middleware](#middleware)
    - [InsightsProvider](#insightsprovider)
    - [Pageview Tracking](#pageview-tracking)
    - [Client Hooks](#client-hooks)
    - [Server-Side Usage](#server-side-usage)
- [Pages Router Setup](#pages-router-setup)
    - [InsightsProvider (Pages)](#insightsprovider-pages)
    - [Pageview Tracking (Pages)](#pageview-tracking-pages)
    - [Server-Side Props](#server-side-props)
    - [Bootstrapping Flags (Pages)](#bootstrapping-flags-pages)

- [Feature Flag Bootstrap](#feature-flag-bootstrap)
- [Consent Management](#consent-management)
- [Middleware Reference](#middleware-reference)
    - [API Proxy](#api-proxy)
    - [Composing with Other Middleware](#composing-with-other-middleware)
    - [Consent Options](#middleware-consent-options)
- [API Reference](#api-reference)

---

## App Router Setup

### Environment Variables

```env
# Required (or pass apiKey as a prop)
NEXT_PUBLIC_INSIGHTS_KEY=phc_your_key_here

# Optional — custom Insights host
NEXT_PUBLIC_INSIGHTS_HOST=https://us.i.insights.com
```

### Middleware

The middleware serves two purposes: seeding the Insights identity cookie on first visit, and optionally proxying API requests through your domain.

```ts
// middleware.ts
import { insightsMiddleware } from '@insights/next'

export default insightsMiddleware({ proxy: true })

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

The middleware generates a UUIDv7 anonymous ID and sets the `ph_<key>_insights` cookie on the first request. This ensures both client and server share the same identity from the very first render.

### InsightsProvider

`InsightsProvider` is a React Server Component that wraps your app with the Insights context.

```tsx
// app/layout.tsx
import { Suspense } from 'react'
import { InsightsProvider, InsightsPageView } from '@insights/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <InsightsProvider
                    apiKey={process.env.NEXT_PUBLIC_INSIGHTS_KEY!}
                    clientOptions={{ api_host: '/ingest' }}
                    bootstrapFlags
                >
                    <Suspense fallback={null}>
                        <InsightsPageView />
                    </Suspense>
                    {children}
                </InsightsProvider>
            </body>
        </html>
    )
}
```

**Props:**

| Prop             | Type                              | Default                   | Description                                                                                        |
| ---------------- | --------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `apiKey`         | `string`                          | `NEXT_PUBLIC_INSIGHTS_KEY` | Insights project API key. Read from env var if omitted.                                             |
| `clientOptions`  | `Partial<InsightsConfig>`          | See below                 | `insights-js` configuration overrides.                                                              |
| `serverOptions`  | `Partial<InsightsOptions>`         | `undefined`               | `insights-node` configuration overrides for server-side flag evaluation.                            |
| `bootstrapFlags` | `boolean \| BootstrapFlagsConfig` | `undefined`               | Enable server-side feature flag evaluation. See [Feature Flag Bootstrap](#feature-flag-bootstrap). |
| `children`       | `React.ReactNode`                 | —                         | Your app content.                                                                                  |

**Default options applied automatically:**

```ts
{
    capture_pageview: false,
    persistence: 'localStorage+cookie',
    opt_out_capturing_persistence_type: 'cookie',
    opt_out_persistence_by_default: true,
}
```

These defaults disable automatic pageviews (so `InsightsPageView` doesn't cause duplicates) and ensure the server can read identity and consent state from cookies. You can override any of them via the `clientOptions` prop.

**Static vs Dynamic rendering:**

By default (without `bootstrapFlags`), `InsightsProvider` does not call any dynamic Next.js APIs (`cookies()`, `headers()`). This makes it compatible with static generation, ISR, and Partial Prerendering (PPR).

When `bootstrapFlags` is enabled, the provider calls `cookies()` and evaluates flags server-side, which opts the route into dynamic rendering.

### Pageview Tracking

`InsightsPageView` is a client component that automatically captures `$pageview` events on route changes. This is needed because Next.js App Router navigations are soft (client-side) — the browser doesn't fire a full page load, so `insights-js`'s built-in pageview tracking doesn't trigger.

```tsx
import { InsightsPageView } from '@insights/next'

// Inside your InsightsProvider:
;<InsightsPageView />
```

### Client Hooks

All hooks are re-exported from `insights-js/react` and must be used in client components (`'use client'`).

```tsx
'use client'
import { useInsights, useFeatureFlag, useActiveFeatureFlags, InsightsFeature } from '@insights/next'
```

| Export                    | Type                             | Description                                                     |
| ------------------------- | -------------------------------- | --------------------------------------------------------------- |
| `useInsights()`            | `Insights`                        | Returns the `insights-js` client instance.                       |
| `useFeatureFlag(key)`     | `FeatureFlagResult \| undefined` | Returns the flag result (`{ key, enabled, variant, payload }`). |
| `useActiveFeatureFlags()` | `string[]`                       | Returns all active (truthy) feature flag keys.                  |
| `InsightsFeature`          | Component                        | Conditionally renders children based on a flag.                 |

**Example: Event capture**

```tsx
'use client'
import { useInsights } from '@insights/next'

export function TrackButton() {
    const insights = useInsights()
    return <button onClick={() => insights.capture('button_clicked')}>Track</button>
}
```

**Example: Feature flag component**

```tsx
'use client'
import { InsightsFeature } from '@insights/next'

export function NewBanner() {
    return (
        <InsightsFeature flag="show-banner" match={true}>
            <div>New feature available!</div>
        </InsightsFeature>
    )
}
```

### Server-Side Usage

Use `getInsights()` in server components, route handlers, and server actions to evaluate flags and capture events server-side. The returned client is preconfigured with the current user's context (distinct ID, session ID, and device ID) read from the Insights cookie, so all flag evaluations and captured events are automatically attributed to the correct user.

```tsx
import { getInsights } from '@insights/next'

export default async function DashboardPage() {
    const insights = await getInsights()

    // Evaluate feature flags
    const flags = await insights.getAllFlags()
    const result = await insights.getFeatureFlagResult('new-dashboard')
    const showNewDashboard = result?.enabled

    // Capture server-side events
    insights.capture({ event: 'dashboard_viewed' })

    return <div>{showNewDashboard ? <NewDashboard /> : <OldDashboard />}</div>
}
```

**Note:** `getInsights()` calls `cookies()` internally, which automatically opts the route into dynamic rendering. Pages using it cannot be statically generated.

`getInsights()` accepts optional parameters:

```ts
const insights = await getInsights(apiKey?, options?)
```

| Parameter | Type                      | Description                                                   |
| --------- | ------------------------- | ------------------------------------------------------------- |
| `apiKey`  | `string`                  | Override the API key (defaults to `NEXT_PUBLIC_INSIGHTS_KEY`). |
| `options` | `Partial<InsightsOptions>` | `insights-node` options (e.g., `{ host: '...' }`).             |

The returned client is scoped to the current user via `enterContext()`. The user's identity, session ID, and device ID are automatically read from the Insights cookie. Server clients are cached and reused across requests.

---

## Pages Router Setup

### InsightsProvider (Pages)

Wrap your `_app` with `InsightsProvider` to initialize Insights for all pages:

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app'
import { InsightsProvider, InsightsPageView } from '@insights/next/pages'

export default function App({ Component, pageProps }: AppProps) {
    return (
        <InsightsProvider apiKey={process.env.NEXT_PUBLIC_INSIGHTS_KEY!} clientOptions={{ api_host: '/ingest' }}>
            <InsightsPageView />
            <Component {...pageProps} />
        </InsightsProvider>
    )
}
```

**Props:**

| Prop            | Type                     | Default                   | Description                                                  |
| --------------- | ------------------------ | ------------------------- | ------------------------------------------------------------ |
| `apiKey`        | `string`                 | `NEXT_PUBLIC_INSIGHTS_KEY` | Insights project API key. Read from env var if omitted.       |
| `clientOptions` | `Partial<InsightsConfig>` | See below                 | `insights-js` configuration overrides.                        |
| `bootstrap`     | `BootstrapConfig`        | `undefined`               | Server-evaluated bootstrap data from `getServerSideInsights`. |
| `children`      | `React.ReactNode`        | —                         | Your app content.                                            |

The same [default options](#insightsprovider) are applied automatically. The `api_host` can also be set via the `NEXT_PUBLIC_INSIGHTS_HOST` environment variable.

### Pageview Tracking (Pages)

`InsightsPageView` (from `@insights/next/pages`) tracks route changes using `next/router`. Place it inside your `InsightsProvider`:

```tsx
import { InsightsPageView } from '@insights/next/pages'

// Inside your InsightsProvider in _app.tsx:
;<InsightsPageView />
```

It captures a `$pageview` event on every `router.asPath` change, including query parameters.

### Server-Side Props

Use `getServerSideInsights` inside your existing `getServerSideProps` to access a Insights server client scoped to the current user:

```tsx
// pages/dashboard.tsx
import type { GetServerSideProps } from 'next'
import { getServerSideInsights } from '@insights/next/pages'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const insights = await getServerSideInsights(ctx)

    // Evaluate flags for the current user
    const result = await insights.getFeatureFlagResult('new-ui')

    // Capture a server-side event
    insights.capture({ event: 'dashboard_viewed' })

    return { props: { showNewUI: result?.enabled ?? false } }
}

export default function Dashboard({ showNewUI }: { showNewUI: boolean }) {
    return <div>{showNewUI ? 'New UI' : 'Classic UI'}</div>
}
```

`getServerSideInsights` returns a `insights-node` client preconfigured with the current user's context (distinct ID, session ID, device ID) read from the Insights cookie. Methods like `getAllFlags()`, `getFeatureFlagResult()`, and `capture()` automatically use this identity.

The API key defaults to `NEXT_PUBLIC_INSIGHTS_KEY`. You can override it with an optional second argument: `getServerSideInsights(ctx, 'phc_custom_key')`.

### Bootstrapping Flags (Pages)

To eliminate flag flicker on page load, evaluate flags server-side and pass them as bootstrap data to the provider:

```tsx
// pages/dashboard.tsx
import type { GetServerSideProps } from 'next'
import { getServerSideInsights } from '@insights/next/pages'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const insights = getServerSideInsights(ctx)
    const flags = await insights.getAllFlagsAndPayloads()
    return { props: { insightsBootstrap: flags } }
}
```

Then wire the bootstrap data into the provider via `pageProps`:

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app'
import { InsightsProvider, InsightsPageView } from '@insights/next/pages'

export default function App({ Component, pageProps }: AppProps) {
    return (
        <InsightsProvider
            apiKey={process.env.NEXT_PUBLIC_INSIGHTS_KEY!}
            clientOptions={{ api_host: '/ingest' }}
            bootstrap={pageProps.insightsBootstrap}
        >
            <InsightsPageView />
            <Component {...pageProps} />
        </InsightsProvider>
    )
}
```

---

## Feature Flag Bootstrap

Bootstrap lets the server evaluate feature flags and pass the results to the client SDK, eliminating the round-trip to Insights's API on page load. Hooks like `useFeatureFlag()` return real values immediately.

### Basic usage

Pass `bootstrapFlags` as `true` to evaluate all flags:

```tsx
<InsightsProvider bootstrapFlags>{children}</InsightsProvider>
```

### Advanced usage

Pass an object to control evaluation:

```tsx
<InsightsProvider
    bootstrapFlags={{
        flags: ['new-ui', 'pricing-v2'], // only evaluate these flags
        groups: { company: 'insights' }, // evaluate for a group
        personProperties: { plan: 'enterprise' }, // known person properties
        groupProperties: {
            // known group properties
            company: { industry: 'tech' },
        },
    }}
>
    {children}
</InsightsProvider>
```

**`BootstrapFlagsConfig` options:**

| Property           | Type                                     | Description                                               |
| ------------------ | ---------------------------------------- | --------------------------------------------------------- |
| `flags`            | `string[]`                               | Specific flag keys to evaluate. Evaluates all if omitted. |
| `groups`           | `Record<string, string>`                 | Groups to evaluate flags for.                             |
| `personProperties` | `Record<string, string>`                 | Known person properties for local evaluation.             |
| `groupProperties`  | `Record<string, Record<string, string>>` | Known group properties for local evaluation.              |

### How it works

1. The provider reads the identity cookie via `cookies()`
2. It calls `insights-node`'s `getAllFlagsAndPayloads()` with the user's `distinctId`
3. Results are passed as `bootstrap` data to `insights-js`
4. `advanced_disable_feature_flags_on_first_load` is set to `true` so the client doesn't re-fetch flags
5. The node client is cached and reused across requests

### Trade-offs

- Enabling `bootstrapFlags` opts the route into **dynamic rendering** (incompatible with static generation / ISR)
- Adds a server-side call to Insights on each request (deduplicated per render)
- If the user has opted out of tracking, flag evaluation is skipped and no bootstrap data is passed

---

## Consent Management

The SDK is consent-aware at every layer. Here's how to implement a consent banner:

### Client-side consent

See the [ConsentBanner example](./examples/app-router/app/components/ConsentBanner.tsx) for a working implementation using `opt_in_capturing()`, `opt_out_capturing()`, and `get_explicit_consent_status()`.

### How consent flows through the stack

1. **insights-js** writes a consent cookie (`__ph_opt_in_out_<apiKey>`) with value `1` (opted in) or `0` (opted out)
2. **Middleware** reads the consent cookie. If opted out, it skips identity cookie seeding and deletes any existing identity cookie
3. **InsightsProvider** checks consent before evaluating bootstrap flags. If opted out, no flags are evaluated
4. **getInsights()** checks consent before setting up user context. If opted out, the client is returned without identity scoping

### Consent defaults

The package applies these defaults to ensure the server can read consent:

```ts
{
    opt_out_capturing_persistence_type: 'cookie',   // write consent to a cookie (not localStorage)
    opt_out_persistence_by_default: true,           // disable persistence when opted out
}
```

### Requiring consent before cookies

If your app requires user consent before setting any cookies, disable anonymous cookie seeding in the middleware:

```ts
export default insightsMiddleware({
    proxy: true,
    seedAnonymousCookie: false,
})
```

And on the client:

```tsx
<InsightsProvider clientOptions={{ opt_out_capturing_by_default: true }}>
```

With this configuration, no identity cookie is seeded and no flags are evaluated until the user explicitly opts in.

---

## Middleware Reference

### API Proxy

Proxying routes Insights API calls through your domain, which can help avoid ad blockers.

```ts
// Simplest — defaults to path prefix '/ingest' and host 'https://us.i.insights.com'
export default insightsMiddleware({ proxy: true })
```

```ts
// Custom path and host
export default insightsMiddleware({
    proxy: {
        pathPrefix: '/analytics',
        host: 'https://eu.i.insights.com',
    },
})
```

When using the proxy, set `api_host` to the path prefix in your provider `clientOptions`:

```tsx
<InsightsProvider clientOptions={{ api_host: '/ingest' }}>
```

**How it works:** Requests matching the path prefix (e.g., `/ingest/e`, `/ingest/decide`) are rewritten to the Insights ingest host via `NextResponse.rewrite()`. The path prefix is stripped and the remaining path and query string are forwarded.

### Composing with Other Middleware

Pass an existing `NextResponse` to compose Insights middleware with your own:

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { insightsMiddleware } from '@insights/next'

export default async function middleware(request: NextRequest) {
    // Your custom middleware logic
    const response = NextResponse.next()
    response.headers.set('x-custom-header', 'value')

    // Insights seeds cookies on the existing response
    return insightsMiddleware({ proxy: true, response })(request)
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Middleware Consent Options

| Option                | Type      | Default                    | Description                                                                                                  |
| --------------------- | --------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `seedAnonymousCookie` | `boolean` | `true`                     | Seed the anonymous identity cookie on first visit. Set to `false` to require consent before setting cookies. |
| `consentCookieName`   | `string`  | `__ph_opt_in_out_<apiKey>` | Custom consent cookie name. Mirrors `consent_persistence_name`.                                              |
| `consentCookiePrefix` | `string`  | `__ph_opt_in_out_`         | Custom consent cookie prefix. Mirrors `opt_out_capturing_cookie_prefix`.                                     |

### Full Middleware Options

```ts
interface InsightsMiddlewareOptions {
    apiKey?: string // defaults to NEXT_PUBLIC_INSIGHTS_KEY
    cookieMaxAgeSeconds?: number // default: 365 days (31,536,000 seconds)
    response?: NextResponse // compose with existing middleware
    seedAnonymousCookie?: boolean // default: true
    consentCookieName?: string // custom consent cookie name
    consentCookiePrefix?: string // custom consent cookie prefix
    proxy?: boolean | InsightsProxyOptions // enable API proxying
}

interface InsightsProxyOptions {
    pathPrefix?: string // default: '/ingest'
    host?: string // default: 'https://us.i.insights.com'
}
```

---

## API Reference

### `@insights/next` (main entry point)

**Server context** (React Server Components):

| Export                          | Description                                                      |
| ------------------------------- | ---------------------------------------------------------------- |
| `InsightsProvider`               | Async server component that wraps your app with Insights context. |
| `InsightsPageView`               | Client component for automatic pageview tracking.                |
| `useInsights`                    | Hook returning the `insights-js` client instance.                 |
| `useFeatureFlag`                | Hook returning a feature flag's value.                           |
| `useActiveFeatureFlags`         | Hook returning all active flag keys.                             |
| `InsightsFeature`                | Component for conditional rendering based on a flag.             |
| `getInsights(apiKey?, options?)` | Returns a `insights-node` client scoped to the current user.      |
| `insightsMiddleware(options?)`   | Creates a Next.js middleware function.                           |
| `DEFAULT_INGEST_PATH`           | The default proxy path prefix (`'/ingest'`).                     |

**Client context** (the same, minus server-only exports):

| Export                  | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `InsightsPageView`       | Client component for automatic pageview tracking.    |
| `useInsights`            | Hook returning the `insights-js` client instance.     |
| `useFeatureFlag`        | Hook returning a feature flag's value.               |
| `useActiveFeatureFlags` | Hook returning all active flag keys.                 |
| `InsightsFeature`        | Component for conditional rendering based on a flag. |

**Types** (available in both contexts):

| Export                     | Description                         |
| -------------------------- | ----------------------------------- |
| `InsightsProviderProps`     | Props for `InsightsProvider`.        |
| `BootstrapFlagsConfig`     | Configuration for `bootstrapFlags`. |
| `InsightsMiddlewareOptions` | Type for middleware configuration.  |
| `InsightsProxyOptions`      | Type for proxy configuration.       |

### `@insights/next/pages`

| Export                                         | Description                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `InsightsProvider`                              | Composable provider for `_app.tsx`.                              |
| `InsightsPageView`                              | Pageview tracker using `next/router`.                            |
| `getServerSideInsights(ctx, apiKey?, options?)` | Returns a scoped `insights-node` client for `getServerSideProps`. |
| `PagesInsightsProviderProps`                    | Type for `InsightsProvider` props.                                |

---

## Architecture Notes

### Cookie format

The identity cookie is named `ph_<sanitized_key>_insights` and contains JSON:

```json
{
    "distinct_id": "01234567-...",
    "$device_id": "01234567-...",
    "$user_state": "anonymous",
    "$sesid": [1708000000000, "session-uuid", 1708000000000]
}
```

### Server client caching

Both `getInsights()` (App Router) and `getServerSideInsights()` (Pages Router) reuse `insights-node` client instances across requests. Clients are cached by `apiKey:host` combination in a module-level `Map`. Per-request isolation is achieved via `enterContext()` which uses `AsyncLocalStorage`.

### Client initialization

The client-side `insights-js` instance is initialized eagerly during render (not in a `useEffect`). This is intentional — React fires effects bottom-up, so child effects (e.g., a consent banner) would otherwise try to access Insights before the parent provider's effect has run. The `__loaded` guard on `insights-js` prevents double initialization in React StrictMode.

### Request scoping via `enterContext()`

On the server, `getInsights()` calls `client.enterContext()` to scope the shared client to the current request's user. This sets the `distinctId`, `$session_id`, and `$device_id` for all subsequent calls within that request. This is what allows a single cached `insights-node` instance to serve multiple concurrent requests correctly.

---

## Known Gaps

This section is intentionally kept as a placeholder for future gaps.
