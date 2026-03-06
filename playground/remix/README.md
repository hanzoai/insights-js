# Insights Remix Playground

This is a basic Remix application demonstrating Insights integration following the [official Insights Remix documentation](https://insights.hanzo.ai/docs/libraries/remix).

## Features

- Automatic pageview tracking with `capture_pageview: 'history_change'`
- Custom event capture using Insights React hooks
- Insights React Provider integration
- Proper Vite configuration for SSR support
- Navigation header for multi-page testing
- Media page with base64 images for replay testing

## Setup

### Quick Start

Run the automated setup script:

```bash
./bin/localdev.sh
```

This will:

1. Build the Insights packages from the repo root
2. Create tarballs in the target directory
3. Set up symlinks
4. Install dependencies
5. Start the dev server

### Manual Setup

1. Build and package Insights libraries from the repo root:

```bash
cd ../..
pnpm build
pnpm package
```

2. Return to the Remix playground and install dependencies:

```bash
cd playground/remix
pnpm install
```

3. Start the development server:

```bash
pnpm dev
```

4. Open http://localhost:5173 in your browser

## Example Pages

- **Home (`/`)** - Main page with custom event capture button
- **Media (`/media`)** - Base64 image generation and testing for session replay

## Additional Resources

- [Insights Remix Documentation](https://insights.hanzo.ai/docs/libraries/remix)
- [Remix Analytics Tutorial](https://insights.hanzo.ai/tutorials/remix-analytics)
- [Remix A/B Testing](https://insights.hanzo.ai/tutorials/remix-ab-tests)
- [Remix Surveys](https://insights.hanzo.ai/tutorials/remix-surveys)
