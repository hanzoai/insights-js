# Getting started

### Requirements

```shell
# Install Insights CLI globally
cargo install insights-cli
```

From the project root directory:
```shell
# Install deps
pnpm install

# Build local version of @hanzo/insights
pnpm run build-insights
```

## Sourcemaps management

Commands to test sourcemap upload:
```shell
# Generate build artifacts and use insights-cli to inject snippets into sources and sourcemaps
VITE_INSIGHTS_KEY='<your-project-key>' VITE_INSIGHTS_HOST='http://localhost:8010' pnpm run build

# For NextJS based app use
NEXT_PUBLIC_INSIGHTS_KEY='<your-project-key>' NEXT_PUBLIC_INSIGHTS_HOST='http://localhost:8010' pnpm run build

# Use insights-cli to inject snippets into sources and sourcemaps
pnpm run inject

# Upload sourcemaps to Insights
pnpm run upload

# Run application locally with newly generated minified build and sourcemaps
# Start sending exceptions to Insights
pnpm run preview
```
