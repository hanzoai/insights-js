# Insights Web

> 🚧 This is a reduced feature set package. Currently the only officially supported feature complete way of using Insights on the web is [@hanzo/insights](https://github.com/hanzoai/@hanzo/insights)

This package is currently published to npm as [@hanzo/insights-lite](https://www.npmjs.com/package/@hanzo/insights-lite) and is a simplified version of the recommended and officially supported `@hanzo/insights`

You'd want to use this only if you're very conscious about package sizes, and this reduced feature set (only analytics and feature flags) works for your use case. The most common use case is in chrome extensions.

## Installation

```bash
npm i -s @hanzo/insights-lite
# or
yarn add @hanzo/insights-lite
```

It is entirely written in Typescript and has a minimal API as follows:

```ts
import Insights from '@hanzo/insights-lite'

const insights = new Insights('my-api-key', {
  /* options, e.g. for self-hosted users */
  // host: "https://my-insights.app.com"
})

// Capture generic events
insights.capture('my-event', { myProperty: 'foo' })

// Identify a user (e.g. on login)
insights.identify('my-unique-user-id', { email: 'example@insights.hanzo.ai', name: 'Jane Doe' })
// ...or with Set Once additional properties
insights.identify('my-unique-user-id', { $set: { email: 'example@insights.hanzo.ai', name: 'Jane Doe' }, $set_once: { vip: true } })

// Reset a user (e.g. on logout)
insights.reset()

// Register properties to be sent with all subsequent events
insights.register({ itemsInBasket: 3 })
// ...or get rid of them if you don't want them anymore
insights.unregister('itemsInBasket')

// Add the user to a group
insights.group('organisations', 'org-1')
// ...or multiple groups at once
insights.group({ organisations: 'org-1', project: 'project-1' })

// Simple feature flags
if (insights.isFeatureEnabled('my-feature-flag')) {
  renderFlaggedFunctionality()
} else {
  renderDefaultFunctionality()
}

// Multivariate feature flags
if (insights.getFeatureFlag('my-feature-flag-with-variants') === 'variant1') {
  renderVariant1()
} else if (insights.getFeatureFlag('my-feature-flag-with-variants') === 'variant2') {
  renderVariant1()
} else if (insights.getFeatureFlag('my-feature-flag-with-variants') === 'control') {
  renderControl()
}

// Override a feature flag for a specific user (e.g. for testing or user preference)
insights.overrideFeatureFlag('my-feature-flag', true)

// Listen reactively to feature flag changes
insights.onFeatureFlag('my-feature-flag', (value) => {
  respondToFeatureFlagChange(value)
})

// Opt users in or out, persisting across sessions (default is they are opted in)
insights.optOut() // Will stop tracking
insights.optIn() // Will start tracking
```

## History API Navigation Tracking

Single-page applications (SPAs) typically use the History API (`pushState`, `replaceState`) for navigation instead of full page loads. By default, Insights only tracks the initial page load.

To automatically track navigation events in SPAs, enable the `captureHistoryEvents` option:

```ts
const insights = new Insights('my-api-key', {
  captureHistoryEvents: true
})
```

When enabled, Insights will:
- Track calls to `history.pushState()` and `history.replaceState()`
- Track `popstate` events (browser back/forward navigation)
- Send these as `$pageview` events with the current URL and pathname
- Include the navigation type (`pushState`, `replaceState`, or `popstate`) as a property

This ensures accurate page tracking in modern web applications without requiring manual pageview capture calls.
