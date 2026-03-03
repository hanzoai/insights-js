import posthogJs, { BootstrapConfig } from '@hanzo/insights'
import { createContext } from 'react'

export type PostHog = typeof posthogJs

export const PostHogContext = createContext<{ client: PostHog; bootstrap?: BootstrapConfig }>({
    client: posthogJs,
    bootstrap: undefined,
})
