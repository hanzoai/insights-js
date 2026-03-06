# @hanzo/types

Type definitions for the Insights JavaScript SDK.

## When to Use This Package

### ✅ You Need This Package If:

You're loading Insights via a **`<script>` tag** and want TypeScript types for `window.insights`.

```html
<!-- You load Insights like this -->
<script>
    !function(t,e){...}(document,window.insights||[]);
    insights.init('your-api-key', { api_host: 'https://us.i.insights.hanzo.ai' })
</script>
```

### ❌ You Don't Need This Package If:

You're installing any Insights library via npm/yarn/pnpm. The types are **already included**:

- `@hanzo/insights` - Browser SDK (includes all types)
- `@hanzo/insights-node` - Node.js SDK
- `@hanzo/insights-react-native` - React Native SDK
- `@hanzo/react` - React hooks and components

```typescript
// Types are already available when you install @hanzo/insights
import insights from '@hanzo/insights'

insights.init('your-api-key')
insights.capture('my_event') // ✅ Fully typed
```

## Installation

```bash
npm install @hanzo/types
# or
yarn add @hanzo/types
# or
pnpm add @hanzo/types
```

## Usage

### Typing `window.insights` (Script Tag Usage)

Create a type declaration file to type `window.insights`:

```typescript
// insights.d.ts
import type { Insights } from '@hanzo/types'

declare global {
    interface Window {
        insights?: Insights
    }
}

export {}
```

Now you can use `window.insights` with full type safety:

```typescript
// Your code
window.insights?.capture('button_clicked', { button_id: 'signup' })
window.insights?.identify('user-123', { email: 'user@example.com' })

const flagValue = window.insights?.getFeatureFlag('my-flag')
if (flagValue === 'variant-a') {
    // ...
}
```

### Typing Configuration Objects

```typescript
import type { InsightsConfig, Properties } from '@hanzo/types'

// Type your configuration
const config: Partial<InsightsConfig> = {
    api_host: 'https://us.i.insights.hanzo.ai',
    autocapture: true,
    capture_pageview: 'history_change',
}

// Type event properties
const eventProps: Properties = {
    button_id: 'signup',
    page: '/pricing',
}
```

## Version Synchronization

This package's version is synchronized with `@hanzo/insights`. They are always released together with matching version numbers.

## License

MIT
