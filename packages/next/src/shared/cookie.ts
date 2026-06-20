// Cookie helpers were lifted to `@hanzo/insights-core` so all SDKs (posthog-node,
// posthog-js-lite, etc.) can share them. This module re-exports the public
// surface for any internal `@hanzo/insights-next` imports — keep using these from
// `./shared/cookie` within next/, or import directly from `@hanzo/insights-core`.
export {
    cookieStateToProperties,
    cookieStoreFromHeader,
    getConsentCookieName,
    getPostHogCookieName,
    isOptedOut,
    parsePostHogCookie,
    readPostHogCookie,
    serializePostHogCookie,
} from '@hanzo/insights-core'
export type { ConsentConfig, ConsentCookieConfig, CookieStore, PostHogCookieState } from '@hanzo/insights-core'
