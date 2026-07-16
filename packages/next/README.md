# @insights/next

The official Insights integration for Next.js. Provides analytics, feature flags, and event capture across the App Router (React Server Components), Pages Router, and middleware — with a single unified package.

## Features

- **App Router support** with a server-component `InsightsProvider` that bootstraps feature flags via SSR
- **Pages Router support** via `InsightsProvider`, `InsightsPageView`, and `getServerSideInsights`
- **Middleware** for identity cookie seeding and optional API proxying
- **Server-side feature flags** via `getInsights()` in server components and route handlers
- **Automatic pageview tracking** with the `InsightsPageView` component
- **Consent-aware** — all server-side code respects the user's opt-in/opt-out preference
- **Static-safe by default** — the provider does not call dynamic APIs unless you enable `bootstrapFlags`

## Install

```bash
npm install @insights/next
# or
pnpm add @insights/next
# or
yarn add @insights/next
```

**Peer dependencies**: `next` >= 13.0.0, `react` >= 18.0.0, `react-dom` >= 18.0.0

## Quick Start (App Router)

### 1. Set environment variables

```env
NEXT_PUBLIC_INSIGHTS_KEY=phc_your_key_here
NEXT_PUBLIC_INSIGHTS_HOST=https://us.i.insights.com  # optional
```

### 2. Add middleware

```ts
// middleware.ts
import { insightsMiddleware } from '@insights/next'

export default insightsMiddleware({ proxy: true })

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### 3. Wrap your layout

```tsx
// app/layout.tsx
import { InsightsProvider, InsightsPageView } from '@insights/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <InsightsProvider clientOptions={{ api_host: '/ingest' }} bootstrapFlags>
                    <InsightsPageView />
                    {children}
                </InsightsProvider>
            </body>
        </html>
    )
}
```

### 4. Use Insights

```tsx
// In a client component
'use client'
import { useInsights, useFeatureFlag } from '@insights/next'

export function MyComponent() {
    const insights = useInsights()
    const showNewUI = useFeatureFlag('new-ui')

    return <button onClick={() => insights.capture('clicked')}>Click me</button>
}
```

```tsx
// In a server component
import { getInsights } from '@insights/next'

export default async function Page() {
    const insights = await getInsights()
    const flags = await insights.getAllFlags()
    insights.capture({ event: 'page_viewed' })
    // ...
}
```

For detailed usage including Pages Router, consent management, middleware composition, and all API options, see [USAGE.md](./USAGE.md).

## Entry Points

| Import path           | Environment     | Purpose                                                                            |
| --------------------- | --------------- | ---------------------------------------------------------------------------------- |
| `@insights/next`       | Client + Server | `InsightsProvider`, `InsightsPageView`, hooks, `getInsights()`, `insightsMiddleware()` |
| `@insights/next/pages` | Client + Server | `InsightsProvider`, `InsightsPageView`, `getServerSideInsights()` for Pages Router    |

## Environment Variables

| Variable                   | Required                    | Description                                                  |
| -------------------------- | --------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_INSIGHTS_KEY`  | Yes (unless passed as prop) | Your Insights project API key (`phc_...`)                     |
| `NEXT_PUBLIC_INSIGHTS_HOST` | No                          | Custom Insights host (defaults to `https://us.i.insights.com`) |

## How It Works

1. **Middleware** runs on every request and seeds an identity cookie (`ph_<key>_insights`) with a UUIDv7 anonymous ID if none exists. It optionally proxies SDK API calls through your domain.

2. **InsightsProvider** (a React Server Component) reads that cookie. When `bootstrapFlags` is enabled, it evaluates feature flags server-side via `insights-node` and passes the results to the client as bootstrap data — so hooks return real values immediately without a network round-trip.

3. **Client components** use `insights-js` under the hood. The SDK is initialized eagerly during render (not in a `useEffect`) so that child components and hooks can access a fully configured instance immediately.

4. **Server utilities** (`getInsights()`) read the same identity cookie and scope the `insights-node` client per request via `enterContext()`, so events and flag evaluations are attributed to the correct user.

5. **Consent** is checked at every layer. If the user has opted out (via the consent cookie), the middleware skips cookie seeding, the provider skips flag evaluation, and `getInsights()` skips context setup.
