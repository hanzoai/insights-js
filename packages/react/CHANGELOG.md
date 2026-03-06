# @hanzo/react

## 1.8.1

### Patch Changes

- [#3146](https://github.com/hanzoai/@hanzo/insights/pull/3146) [`85030ed`](https://github.com/hanzoai/@hanzo/insights/commit/85030edfe9737d30d78a589462f4c9388f9ea057) Thanks [@gustavohstrassburger](https://github.com/gustavohstrassburger)! - Fix InsightsFeature component to properly handle undefined flags and false values
  (2026-02-25)
- Updated dependencies [[`4d0c783`](https://github.com/hanzoai/@hanzo/insights/commit/4d0c783fadac64718da01d1773a65f1d350f8201)]:
    - @hanzo/insights@1.354.0

## 1.8.0

### Minor Changes

- [#3063](https://github.com/hanzoai/@hanzo/insights/pull/3063) [`97046c0`](https://github.com/hanzoai/@hanzo/insights/commit/97046c03b99ce4f2487b96f57c3d4d6a21e38894) Thanks [@dustinbyrne](https://github.com/dustinbyrne)! - feat: Add `useFeatureFlagResult` hook
  (2026-02-17)

### Patch Changes

- Updated dependencies [[`c4ca045`](https://github.com/hanzoai/@hanzo/insights/commit/c4ca0450e6bbd39e7e90c442776ba0cf0b848ce4), [`b11c3c5`](https://github.com/hanzoai/@hanzo/insights/commit/b11c3c58fe14121cda89bc48aeabf817ae44a8d0), [`d36a6ed`](https://github.com/hanzoai/@hanzo/insights/commit/d36a6ed75c68742b07863fed0e7a64ad3f842c8d)]:
    - @hanzo/insights@1.348.0

## 1.7.1

### Patch Changes

- [#3034](https://github.com/hanzoai/@hanzo/insights/pull/3034) [`de43d70`](https://github.com/hanzoai/@hanzo/insights/commit/de43d70e5d94f74cf58745695968eee09fbc64b6) Thanks [@adboio](https://github.com/adboio)! - add survey shown tracking to useThumbSurvey + option to disable shown tracking in displaySurvey
  (2026-02-10)
- Updated dependencies [[`de43d70`](https://github.com/hanzoai/@hanzo/insights/commit/de43d70e5d94f74cf58745695968eee09fbc64b6)]:
    - @hanzo/insights@1.345.1

## 1.7.0

### Minor Changes

- [#2882](https://github.com/hanzoai/@hanzo/insights/pull/2882) [`8a5a3d5`](https://github.com/hanzoai/@hanzo/insights/commit/8a5a3d5693facda62b90b66dead338f7dca19705) Thanks [@adboio](https://github.com/adboio)! - add support for question prefill in popover surveys, add useThumbSurvey hook
  (2026-01-20)

### Patch Changes

- Updated dependencies [[`8a5a3d5`](https://github.com/hanzoai/@hanzo/insights/commit/8a5a3d5693facda62b90b66dead338f7dca19705)]:
    - @hanzo/insights@1.332.0

## 1.6.0

### Minor Changes

- [#2900](https://github.com/hanzoai/@hanzo/insights/pull/2900) [`23770e9`](https://github.com/hanzoai/@hanzo/insights/commit/23770e9e2eed1aca5c2bc7a34a6d64dc115b0d11) Thanks [@dmarticus](https://github.com/dmarticus)! - Renamed `evaluationEnvironments` to `evaluationContexts` for clearer semantics. The term "contexts" better reflects that this feature is for specifying evaluation contexts (e.g., "web", "mobile", "checkout") rather than deployment environments (e.g., "staging", "production").

    ### Deprecated
    - `insights.init` option `evaluationEnvironments` is now deprecated in favor of `evaluationContexts`. The old property will continue to work and will log a deprecation warning. It will be removed in a future major version.

    ### Migration Guide

    ````javascript
    // Before
    insights.init('<ph_project_api_key>', {
        evaluationEnvironments: ['production', 'web', 'checkout'],
    })

    // After
    insights.init('<ph_project_api_key>', {
        evaluationContexts: ['production', 'web', 'checkout'],
    })
    ``` (2026-01-19)
    ````

### Patch Changes

- Updated dependencies [[`23770e9`](https://github.com/hanzoai/@hanzo/insights/commit/23770e9e2eed1aca5c2bc7a34a6d64dc115b0d11)]:
    - @hanzo/insights@1.331.0

## 1.5.2

### Patch Changes

- [#2690](https://github.com/hanzoai/@hanzo/insights/pull/2690) [`e9c00fd`](https://github.com/hanzoai/@hanzo/insights/commit/e9c00fd451f6ee648ff40dcad538d38bfd5f3ff4) Thanks [@robbie-c](https://github.com/robbie-c)! - Related to https://www.wiz.io/blog/critical-vulnerability-in-react-cve-2025-55182

    We didn't include any of the vulnerable deps in any of our packages, however we did have them as dev / test / example project dependencies.

    There was no way that any of these vulnerable packages were included in any of our published packages.

    We've now patched out those dependencies.

    Out of an abundance of caution, let's create a new release of all of our packages. (2025-12-04)

- Updated dependencies [[`e9c00fd`](https://github.com/hanzoai/@hanzo/insights/commit/e9c00fd451f6ee648ff40dcad538d38bfd5f3ff4)]:
    - @hanzo/insights@1.301.2

## 1.5.1

### Patch Changes

- [#2655](https://github.com/hanzoai/@hanzo/insights/pull/2655) [`d10783f`](https://github.com/hanzoai/@hanzo/insights/commit/d10783fb472bdc3a74994a7b74504b525ef725a3) Thanks [@ordehi](https://github.com/ordehi)! - Updated feature flag hooks to properly check if client is initialized and prevent client is undefined errors
  (2025-12-03)
- Updated dependencies [[`4487d6b`](https://github.com/hanzoai/@hanzo/insights/commit/4487d6b28e4f76696f13cea5d08dfceda3aa2cd9), [`0e67750`](https://github.com/hanzoai/@hanzo/insights/commit/0e6775030aa43d24588f2e6dbe624e8d8a1f6d7c), [`e1617d9`](https://github.com/hanzoai/@hanzo/insights/commit/e1617d91255b23dc39b1dcb15b05ae64c735d9d0)]:
    - @hanzo/insights@1.300.0

## 1.5.0

### Minor Changes

- [#2619](https://github.com/hanzoai/@hanzo/insights/pull/2619) [`86dab38`](https://github.com/hanzoai/@hanzo/insights/commit/86dab38e49eeac9819b1ab5f7f0c8b5df88d9f86) Thanks [@hpouillot](https://github.com/hpouillot)! - package deprecation
  (2025-11-24)

### Patch Changes

- Updated dependencies [[`86dab38`](https://github.com/hanzoai/@hanzo/insights/commit/86dab38e49eeac9819b1ab5f7f0c8b5df88d9f86)]:
    - @hanzo/insights@1.298.0

## 1.4.1

### Patch Changes

- [#2618](https://github.com/hanzoai/@hanzo/insights/pull/2618) [`3eed1a4`](https://github.com/hanzoai/@hanzo/insights/commit/3eed1a42a50bff310fde3a91308a0f091b39e3fe) Thanks [@marandaneto](https://github.com/marandaneto)! - last version was compromised
  (2025-11-24)
- Updated dependencies [[`3eed1a4`](https://github.com/hanzoai/@hanzo/insights/commit/3eed1a42a50bff310fde3a91308a0f091b39e3fe)]:
    - @hanzo/insights@1.297.3

## 1.4.0

### Minor Changes

- [#2551](https://github.com/hanzoai/@hanzo/insights/pull/2551) [`10be1b0`](https://github.com/hanzoai/@hanzo/insights/commit/10be1b071ab30da45749b91cfdeff913912e7bbb) Thanks [@dmarticus](https://github.com/dmarticus)! - Support bootstrapping feature flags during SSR in ReactJS

### Patch Changes

- Updated dependencies [[`10be1b0`](https://github.com/hanzoai/@hanzo/insights/commit/10be1b071ab30da45749b91cfdeff913912e7bbb)]:
    - @hanzo/insights@1.289.0

## 1.3.0

### Minor Changes

- [#2517](https://github.com/hanzoai/@hanzo/insights/pull/2517) [`46e3ca6`](https://github.com/hanzoai/@hanzo/insights/commit/46e3ca600ca478db1b319b36695dea090aa60f98) Thanks [@pauldambra](https://github.com/pauldambra)! - feat: add a component that will wrap your components and capture an event when they are in view in the browser

### Patch Changes

- [#2517](https://github.com/hanzoai/@hanzo/insights/pull/2517) [`46e3ca6`](https://github.com/hanzoai/@hanzo/insights/commit/46e3ca600ca478db1b319b36695dea090aa60f98) Thanks [@pauldambra](https://github.com/pauldambra)! - fix: complete react sdk featureflag component refactor

- Updated dependencies [[`46e3ca6`](https://github.com/hanzoai/@hanzo/insights/commit/46e3ca600ca478db1b319b36695dea090aa60f98), [`46e3ca6`](https://github.com/hanzoai/@hanzo/insights/commit/46e3ca600ca478db1b319b36695dea090aa60f98)]:
    - @hanzo/insights@1.282.0

## 1.2.3

### Patch Changes

- [#2390](https://github.com/hanzoai/@hanzo/insights/pull/2390) [`244b3ad`](https://github.com/hanzoai/@hanzo/insights/commit/244b3ad2f6dea8086747046044245b1514bd658b) Thanks [@hpouillot](https://github.com/hpouillot)! - fix react sourcemaps

- Updated dependencies [[`244b3ad`](https://github.com/hanzoai/@hanzo/insights/commit/244b3ad2f6dea8086747046044245b1514bd658b)]:
    - @hanzo/insights@1.270.1

## 1.2.2

### Patch Changes

- [#2389](https://github.com/hanzoai/@hanzo/insights/pull/2389) [`ac17e4a`](https://github.com/hanzoai/@hanzo/insights/commit/ac17e4a61ddc7e71178daadfb1d9284fd574f4a4) Thanks [@pauldambra](https://github.com/pauldambra)! - revert: "fix(react): fix react sourcemaps"

## 1.2.1

### Patch Changes

- [#2374](https://github.com/hanzoai/@hanzo/insights/pull/2374) [`5af6e2d`](https://github.com/hanzoai/@hanzo/insights/commit/5af6e2d1fb1694cecfa4ef515cac192fb194fa4e) Thanks [@hpouillot](https://github.com/hpouillot)! - fix react sourcemaps

- Updated dependencies [[`5af6e2d`](https://github.com/hanzoai/@hanzo/insights/commit/5af6e2d1fb1694cecfa4ef515cac192fb194fa4e)]:
    - @hanzo/insights@1.268.10

## 1.2.0

### Minor Changes

- [#2300](https://github.com/hanzoai/@hanzo/insights/pull/2300) [`e4a147c`](https://github.com/hanzoai/@hanzo/insights/commit/e4a147c86553765d299fb0969bfd390e5aabc952) Thanks [@daibhin](https://github.com/daibhin)! - feat: added helper method for React 19 error callbacks

## 1.1.0

### Minor Changes

- [#2200](https://github.com/hanzoai/@hanzo/insights/pull/2200) [`4387da4`](https://github.com/hanzoai/@hanzo/insights/commit/4387da42148a6b96c7bf1f9f5a2c529a3eb4dd8a) Thanks [@daibhin](https://github.com/daibhin)! - expose captured exception to error boundary fallback

### Patch Changes

- Updated dependencies [[`4387da4`](https://github.com/hanzoai/@hanzo/insights/commit/4387da42148a6b96c7bf1f9f5a2c529a3eb4dd8a), [`fda2932`](https://github.com/hanzoai/@hanzo/insights/commit/fda2932d0c4835d205fe0e0d0efb724b964f9f9b)]:
    - @hanzo/insights@1.260.0
