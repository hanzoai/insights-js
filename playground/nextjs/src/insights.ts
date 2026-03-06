// NOTE: This is how you can include the external dependencies so they are in your bundle and not loaded async at runtime
// import '@hanzo/insights/dist/recorder'
// import '@hanzo/insights/dist/surveys'
// import '@hanzo/insights/dist/product-tours'
// import '@hanzo/insights/dist/exception-autocapture'
// import '@hanzo/insights/dist/tracing-headers'

import insightsJS, { Insights, InsightsConfig } from '@hanzo/insights'
import { User } from './auth'

export const PERSON_PROCESSING_MODE: 'always' | 'identified_only' | 'never' =
    (process.env.NEXT_PUBLIC_INSIGHTS_PERSON_PROCESSING_MODE as any) || 'identified_only'

// optionally skip consent handling, for testing
export const SKIP_CONSENT_HANDLING = false

export const INSIGHTS_USE_SNIPPET: boolean = (process.env.NEXT_PUBLIC_INSIGHTS_USE_SNIPPET as any) || false

export const insights: Insights = INSIGHTS_USE_SNIPPET
    ? typeof window !== 'undefined'
        ? (window as any).insights
        : null
    : insightsJS

// we use undefined for SSR to indicated that we haven't check yet (as the state lives in cookies)
export type ConsentState = 'granted' | 'denied' | 'pending' | undefined

/**
 * Below is an example of a consent-driven config for Insights
 * Lots of things start in a disabled state and insights will not use cookies without consent
 *
 * Once given, we enable autocapture, session recording, and use localStorage+cookie for persistence via set_config
 * This is only an example - data privacy requirements are different for every project
 */
export function cookieConsentGiven(): ConsentState {
    if (typeof window === 'undefined') return undefined
    return insights.get_explicit_consent_status()
}

export const configForConsent = (): Partial<InsightsConfig> => {
    if (SKIP_CONSENT_HANDLING) {
        return {
            disable_surveys: false,
            autocapture: true,
            disable_session_recording: false,
            cookieless_mode: undefined,
        }
    }

    const consentGiven = cookieConsentGiven()

    return {
        disable_surveys: consentGiven !== 'granted',
        autocapture: consentGiven === 'granted',
        disable_session_recording: consentGiven !== 'granted',
    }
}

export const updateInsightsConsent = (consentGiven: ConsentState) => {
    if (SKIP_CONSENT_HANDLING) {
        return
    }

    if (consentGiven !== undefined) {
        if (consentGiven === 'granted') {
            insights.opt_in_capturing()
        } else if (consentGiven === 'denied') {
            insights.opt_out_capturing()
        } else if (consentGiven === 'pending') {
            insights.clear_opt_in_out_capturing()
            insights.reset()
        }
    }

    insights.set_config(configForConsent())
}

if (typeof window !== 'undefined') {
    insights.init(process.env.NEXT_PUBLIC_INSIGHTS_KEY || 'test-token', {
        api_host: process.env.NEXT_PUBLIC_INSIGHTS_HOST || 'https://us.i.insights.com',
        session_recording: {
            recordCrossOriginIframes: true,
            blockSelector: '.ph-block-image',
            ignoreClass: 'ph-ignore-image',
        },
        debug: true,
        capture_pageview: 'history_change',
        disable_web_experiments: false,
        scroll_root_selector: ['#scroll_element', 'html'],
        persistence: 'localStorage+cookie',
        person_profiles: PERSON_PROCESSING_MODE === 'never' ? 'identified_only' : PERSON_PROCESSING_MODE,
        persistence_name: `${process.env.NEXT_PUBLIC_INSIGHTS_KEY || 'test'}_nextjs`,
        opt_in_site_apps: true,
        integrations: {
            intercom: true,
            crispChat: true,
        },
        cookieless_mode: 'on_reject',
        __preview_flags_v2: true,
        __preview_deferred_init_extensions: true,
        disable_product_tours: false,
        ...configForConsent(),
    })
    // Help with debugging
    ;(window as any).insights = insights
}

export const insightsHelpers = {
    onLogin: (user: User) => {
        if (PERSON_PROCESSING_MODE === 'never') {
            // We just set the user properties instead of identifying them
            insightsHelpers.setUser(user)
        } else {
            insights.identify(user.email, user)
        }

        insights.capture('Logged in')
    },
    onLogout: () => {
        insights.capture('Logged out')
        insights.reset()
    },
    setUser: (user: User) => {
        if (PERSON_PROCESSING_MODE === 'never') {
            const eventProperties = {
                person_id: user.email,
                person_email: user.email,
                person_name: user.name,
                team_id: user.team?.id,
                team_name: user.team?.name,
            }
            insights.register(eventProperties)
            insights.setPersonPropertiesForFlags(user)
        } else {
            // NOTE: Would this always get set?
            if (user.team) {
                insights.group('team', user.team.id, user.team)
            }
        }
    },
}
