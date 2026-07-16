import { Insights } from '../insights-core'
import { InsightsConfig } from '../types'
import { AllExtensions } from '../extensions/extension-bundles'
import { Autocapture } from '../autocapture'
import { InsightsFeatureFlags } from '../insights-featureflags'
import { SessionRecording } from '../extensions/replay/session-recording'
import { createInsightsInstance } from './helpers/insights-instance'

describe('__extensionClasses enrollment', () => {
    let savedDefaults: InsightsConfig['__extensionClasses']

    beforeEach(() => {
        savedDefaults = Insights.__defaultExtensionClasses
        console.error = jest.fn()
    })

    afterEach(() => {
        Insights.__defaultExtensionClasses = savedDefaults
    })

    it('initializes only extensions provided via __extensionClasses', async () => {
        Insights.__defaultExtensionClasses = {}

        const insights = await createInsightsInstance(undefined, {
            __preview_deferred_init_extensions: false,
            __extensionClasses: { autocapture: Autocapture, sessionRecording: SessionRecording },
            capture_pageview: false,
        })

        expect(insights.autocapture).toBeDefined()
        expect(insights.sessionRecording).toBeDefined()

        expect(insights.heatmaps).toBeUndefined()
        expect(insights.exceptionObserver).toBeUndefined()
        expect(insights.deadClicksAutocapture).toBeUndefined()
        expect(insights.webVitalsAutocapture).toBeUndefined()
        expect(insights.productTours).toBeUndefined()
        expect(insights.siteApps).toBeUndefined()
    })

    it('initializes no extensions when none are provided and no defaults exist', async () => {
        Insights.__defaultExtensionClasses = {}

        const insights = await createInsightsInstance(undefined, {
            __preview_deferred_init_extensions: false,
            capture_pageview: false,
        })

        expect(insights.autocapture).toBeUndefined()
        expect(insights.sessionRecording).toBeUndefined()
        expect(insights.heatmaps).toBeUndefined()
        expect(insights.exceptionObserver).toBeUndefined()
        expect(insights.deadClicksAutocapture).toBeUndefined()
        expect(insights.webVitalsAutocapture).toBeUndefined()
        expect(insights.productTours).toBeUndefined()
        expect(insights.siteApps).toBeUndefined()
    })

    it('__extensionClasses overrides __defaultExtensionClasses', async () => {
        Insights.__defaultExtensionClasses = AllExtensions

        class MockAutocapture extends Autocapture {}

        const insights = await createInsightsInstance(undefined, {
            __preview_deferred_init_extensions: false,
            __extensionClasses: { autocapture: MockAutocapture },
            capture_pageview: false,
        })

        expect(insights.autocapture).toBeInstanceOf(MockAutocapture)
    })

    it('eagerly constructs extensions from defaults before init()', () => {
        Insights.__defaultExtensionClasses = AllExtensions

        const insights = new Insights()

        expect(insights.featureFlags).toBeDefined()
        expect(insights.toolbar).toBeDefined()
        expect(insights.surveys).toBeDefined()
        expect(insights.conversations).toBeDefined()
        expect(insights.logs).toBeDefined()
        expect(insights.experiments).toBeDefined()
        expect(insights.exceptions).toBeDefined()
    })

    it('does not eagerly construct extensions when no defaults exist', () => {
        Insights.__defaultExtensionClasses = {}

        const insights = new Insights()

        expect(insights.featureFlags).toBeUndefined()
        expect(insights.toolbar).toBeUndefined()
        expect(insights.surveys).toBeUndefined()
        expect(insights.conversations).toBeUndefined()
        expect(insights.logs).toBeUndefined()
        expect(insights.experiments).toBeUndefined()
        expect(insights.exceptions).toBeUndefined()
    })

    it('default extensions are used when __extensionClasses is not provided', async () => {
        Insights.__defaultExtensionClasses = AllExtensions

        const insights = await createInsightsInstance(undefined, {
            __preview_deferred_init_extensions: false,
            capture_pageview: false,
        })

        expect(insights.autocapture).toBeDefined()
        expect(insights.sessionRecording).toBeDefined()
        expect(insights.heatmaps).toBeDefined()
        expect(insights.exceptionObserver).toBeDefined()
        expect(insights.deadClicksAutocapture).toBeDefined()
        expect(insights.webVitalsAutocapture).toBeDefined()
        expect(insights.productTours).toBeDefined()
        expect(insights.siteApps).toBeDefined()
    })
})
