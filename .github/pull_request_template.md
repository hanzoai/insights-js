## Problem

<!-- Who are we building for, what are their needs, why is this important? -->

## Changes

<!-- What is changed and what information would be useful to a reviewer? -->

## Release info Sub-libraries affected

### Libraries affected

<!-- Please mark which libraries will require a version bump. -->

- [ ] All of them
- [ ] @hanzo/insights (web)
- [ ] @hanzo/insights-lite (web lite)
- [ ] @hanzo/insights-node
- [ ] @hanzo/insights-react-native
- [ ] @hanzo/react
- [ ] @hanzo/ai
- [ ] @hanzo/convex
- [ ] @hanzo/nextjs-config
- [ ] @hanzo/nuxt
- [ ] @hanzo/rollup-plugin
- [ ] @hanzo/webpack-plugin
- [ ] @hanzo/types

## Checklist

- [ ] Tests for new code
- [ ] Accounted for the impact of any changes across different platforms
- [ ] Accounted for backwards compatibility of any changes (no breaking changes!)
- [ ] Took care not to unnecessarily increase the bundle size

### If releasing new changes

- [ ] Ran `pnpm changeset` to generate a changeset file
- [ ] Added the "release" label to the PR to indicate we're publishing new versions for the affected packages

<!-- For more details check RELEASING.md -->
