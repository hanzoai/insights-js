# @hanzo/react

React components and hooks for Insights analytics integration.

[SEE FULL DOCS](https://insights.hanzo.ai/docs/libraries/react)

## Installation

```bash
npm install @hanzo/react @hanzo/insights
```

## Usage

### Setting up the Provider

Wrap your application with `InsightsProvider` to make the Insights client available throughout your app:

```tsx
import { InsightsProvider } from '@hanzo/react'

function App() {
    return (
        <InsightsProvider apiKey="<YOUR_PROJECT_API_KEY>" options={{ api_host: 'https://us.i.insights.hanzo.ai' }}>
            <YourApp />
        </InsightsProvider>
    )
}
```

Or pass an existing Insights client instance:

```tsx
import insights from '@hanzo/insights'
import { InsightsProvider } from '@hanzo/react'

// Initialize your client
insights.init('<YOUR_PROJECT_API_KEY>', { api_host: 'https://us.i.insights.hanzo.ai' })

function App() {
    return (
        <InsightsProvider client={insights}>
            <YourApp />
        </InsightsProvider>
    )
}
```

### Hooks

#### useInsights

Access the Insights client instance to capture events, identify users, etc.

```tsx
import { useInsights } from '@hanzo/react'

function MyComponent() {
    const insights = useInsights()

    const handleClick = () => {
        insights.capture('button_clicked', { button_name: 'signup' })
    }

    return <button onClick={handleClick}>Sign Up</button>
}
```

#### useFeatureFlagEnabled

Check if a feature flag is enabled for the current user.

```tsx
import { useFeatureFlagEnabled } from '@hanzo/react'

function MyComponent() {
    const isEnabled = useFeatureFlagEnabled('new-feature')

    if (isEnabled) {
        return <NewFeature />
    }
    return <OldFeature />
}
```

#### useFeatureFlagVariantKey

Get the variant key for a multivariate feature flag.

```tsx
import { useFeatureFlagVariantKey } from '@hanzo/react'

function MyComponent() {
    const variant = useFeatureFlagVariantKey('experiment-flag')

    if (variant === 'control') {
        return <ControlVariant />
    }
    if (variant === 'test') {
        return <TestVariant />
    }
    return null
}
```

#### useFeatureFlagPayload

Get the payload associated with a feature flag.

```tsx
import { useFeatureFlagPayload } from '@hanzo/react'

function MyComponent() {
    const payload = useFeatureFlagPayload('feature-with-payload')

    return <div>Config: {JSON.stringify(payload)}</div>
}
```

#### useActiveFeatureFlags

Get all active feature flags for the current user.

```tsx
import { useActiveFeatureFlags } from '@hanzo/react'

function MyComponent() {
    const activeFlags = useActiveFeatureFlags()

    return (
        <ul>
            {activeFlags?.map((flag) => (
                <li key={flag}>{flag}</li>
            ))}
        </ul>
    )
}
```

### Components

#### InsightsFeature

A component that renders content based on a feature flag's value. Automatically tracks feature views and interactions.

```tsx
import { InsightsFeature } from '@hanzo/react'

function MyComponent() {
    return (
        <InsightsFeature flag="new-cta" fallback={<OldButton />}>
            <NewButton />
        </InsightsFeature>
    )
}

// With variant matching
function MyComponent() {
    return (
        <InsightsFeature flag="experiment" match="test" fallback={<ControlVersion />}>
            <TestVersion />
        </InsightsFeature>
    )
}

// With payload as render function
function MyComponent() {
    return (
        <InsightsFeature flag="banner-config">
            {(payload) => <Banner title={payload.title} color={payload.color} />}
        </InsightsFeature>
    )
}
```

#### InsightsErrorBoundary

An error boundary that captures React errors and reports them to Insights.

```tsx
import { InsightsErrorBoundary } from '@hanzo/react'

function App() {
    return (
        <InsightsProvider apiKey="<YOUR_PROJECT_API_KEY>">
            <InsightsErrorBoundary>
                <YourApp />
            </InsightsErrorBoundary>
        </InsightsProvider>
    )
}
```

Please see the main [Insights docs](https://www.insights.hanzo.ai/docs).

## Questions?

### [Check out our community page.](https://insights.hanzo.ai/posts)
