import './helpers/mock-logger'

import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { createInsightsInstance } from './helpers/insights-instance'
import { uuidv7 } from '../uuidv7'
import { Insights } from '../insights-core'
import {
    AUTH_CALLBACK_CANONICAL_ROUTE,
    AUTH_CALLBACK_OUTCOME_EVENT,
    buildAggregateHeatmapKey,
    buildAuthCallbackOutcome,
    buildConfirmedServerPaymentEvent,
    buildFunnelStepProperties,
    classifyDeviceClass,
    classifyRouteTelemetry,
    combineMaskTextSelectors,
    countConfirmedPayments,
    decorateCrossDomainUrl,
    DEFAULT_REPLAY_URL_BLOCKLIST,
    enforceClientPaymentGuard,
    extractCrossDomainIdentityFromUrl,
    HANZO_ECOSYSTEM_DOMAINS,
    isConfirmedServerPaymentEvent,
    isHanzoEcosystemHost,
    isHeatmapEligibleRoute,
    isSensitiveElement,
    isUxCaptureExcludedRoute,
    MASKED_PLACEHOLDER,
    maskInputValueBeforeCapture,
    maskTextValueBeforeCapture,
    normalizeRouteTemplate,
    resolveStableControlId,
    SENSITIVE_MASK_TEXT_SELECTOR,
} from '../hanzo-telemetry'
import { URLTriggerMatching } from '../extensions/replay/external/triggerMatching'
import { LazyLoadedSessionRecording } from '../extensions/replay/external/lazy-loaded-session-recorder'
import { SESSION_RECORDING_REMOTE_CONFIG } from '../constants'
import { assignableWindow } from '../utils/globals'
import { EventType } from '../extensions/replay/types/rrweb-types'

jest.useFakeTimers()

describe('Hanzo Telemetry Hardening (P0 #3 + Native DOM Replay & Aggregate Heatmaps)', () => {
    let beforeSendMock: jest.Mock

    const navigatePath = (pathAndQuery: string) => {
        window.history.replaceState({}, '', pathAndQuery)
    }

    beforeEach(() => {
        beforeSendMock = jest.fn().mockImplementation((e) => e)
        navigatePath('/dev/my-agent-app')
        Object.defineProperty(window, 'innerWidth', { value: 1440, writable: true, configurable: true })
    })

    describe('1. Funnel Step Event Contract', () => {
        it('enforces { hostname, route, release, device_class, outcome } with normalized route templates', async () => {
            expect(normalizeRouteTemplate('/pay/confirm/card?session=cs_123')).toBe('/pay/confirm/:method')
            expect(normalizeRouteTemplate('/pay/confirm/apple-pay')).toBe('/pay/confirm/:method')
            expect(normalizeRouteTemplate('/dev/my-cool-project')).toBe('/dev/:project')
            expect(normalizeRouteTemplate('/dev/my-cool-project/billing')).toBe('/dev/:project/billing')
            expect(normalizeRouteTemplate('/auth/callback?code=secret&state=123')).toBe('/auth/callback')

            expect(classifyDeviceClass({ width: 390 })).toBe('mobile')
            expect(classifyDeviceClass({ width: 820 })).toBe('tablet')
            expect(classifyDeviceClass({ width: 1440 })).toBe('desktop')

            const props = buildFunnelStepProperties({
                hostname: 'https://Hanzo.App',
                route: '/pay/confirm/stripe',
                release: '2026.11.20',
                viewportWidth: 390,
                outcome: 'started',
            })
            expect(props).toEqual({
                hostname: 'hanzo.app',
                route: '/pay/confirm/:method',
                release: '2026.11.20',
                device_class: 'mobile',
                outcome: 'started',
            })

            const insights = await createInsightsInstance(uuidv7(), {
                before_send: beforeSendMock,
                capture_pageview: false,
                release: '2026.11.20-rc1',
            })

            insights.captureFunnelStep('workspace_deploy', {
                hostname: 'platform.hanzo.ai',
                outcome: 'completed',
            })

            expect(beforeSendMock).toHaveBeenCalledTimes(1)
            expect(beforeSendMock.mock.lastCall![0]).toMatchObject({
                event: 'workspace_deploy',
                properties: {
                    hostname: 'platform.hanzo.ai',
                    route: '/dev/:project',
                    release: '2026.11.20-rc1',
                    device_class: 'desktop',
                    outcome: 'completed',
                },
            })
        })

        it('rejects invalid funnel outcomes', () => {
            expect(() =>
                buildFunnelStepProperties({
                    hostname: 'hanzo.app',
                    route: '/dev/demo',
                    outcome: 'invalid' as any,
                })
            ).toThrow('Invalid funnel outcome')
        })
    })

    describe('2. Confirmed Server-Side Payment Counting', () => {
        it('counts ONLY checkout_completed with confirmed_by=server and downgrades browser claims', async () => {
            const s2sEvent = buildConfirmedServerPaymentEvent({
                hostname: 'hanzo.app',
                route: '/pay/confirm/card',
                release: '2026.11.20',
                device_class: 'desktop',
                confirmation_source: 'stripe_webhook',
                revenue: 99,
                currency: 'usd',
                visitor_id: 'vis_001',
            })

            expect(s2sEvent.event).toBe('checkout_completed')
            expect(s2sEvent.properties).toMatchObject({
                hostname: 'hanzo.app',
                route: '/pay/confirm/:method',
                release: '2026.11.20',
                device_class: 'desktop',
                outcome: 'completed',
                confirmed_by: 'server',
                confirmation_source: 'stripe_webhook',
                revenue: 99,
                currency: 'USD',
            })
            expect(isConfirmedServerPaymentEvent(s2sEvent.event, s2sEvent.properties)).toBe(true)

            // Client-redirect events must NEVER count
            expect(
                isConfirmedServerPaymentEvent('checkout_completed', {
                    confirmed_by: 'client',
                    outcome: 'completed',
                    revenue: 99,
                })
            ).toBe(false)
            expect(
                isConfirmedServerPaymentEvent('checkout_completed', {
                    source: 'client_redirect',
                    confirmed_by: 'server',
                    outcome: 'completed',
                })
            ).toBe(false)
            expect(
                isConfirmedServerPaymentEvent('checkout_completed', {
                    outcome: 'completed',
                })
            ).toBe(false)

            // Browser SDK captureFunnelStep MUST strip/downgrade forged confirmed_by='server'
            const guarded = enforceClientPaymentGuard('checkout_completed', {
                confirmed_by: 'server',
                outcome: 'completed',
            })
            expect(guarded.confirmed_by).toBe('client')
            expect(guarded.payment_counted).toBe(false)

            const insights = await createInsightsInstance(uuidv7(), {
                before_send: beforeSendMock,
                capture_pageview: false,
                release: '2026.11.20',
            })

            insights.captureFunnelStep('checkout_completed', {
                hostname: 'hanzo.app',
                route: '/pay/confirm/card',
                outcome: 'completed',
                properties: { confirmed_by: 'server', revenue: 99, currency: 'USD' },
            })

            const captured = beforeSendMock.mock.lastCall![0] as any
            expect(captured.properties.confirmed_by).toBe('client')
            expect(captured.properties.payment_counted).toBe(false)
            expect(isConfirmedServerPaymentEvent(captured.event, captured.properties)).toBe(false)

            expect(
                countConfirmedPayments([
                    captured,
                    { event: 'checkout_completed', properties: { confirmed_by: 'client_redirect' } },
                    s2sEvent,
                ])
            ).toBe(1)
        })
    })

    describe('3. Cross-Domain Identity Stitching', () => {
        it('links one test customer across hanzo.ai -> hanzo.app -> hanzo.bot -> hanzo.team -> platform.hanzo.ai', async () => {
            for (const host of HANZO_ECOSYSTEM_DOMAINS) {
                expect(isHanzoEcosystemHost(host)).toBe(true)
            }
            expect(isHanzoEcosystemHost('third-party.example.com')).toBe(false)

            const seedIdentity = {
                hz_aid: 'hza_journey_999',
                hz_sid: 'hzs_journey_999',
                visitor_id: 'vis_journey_999',
            }

            // Step 1: start on hanzo.ai with seed query params
            navigatePath(
                `/?hz_aid=${seedIdentity.hz_aid}&hz_sid=${seedIdentity.hz_sid}&visitor_id=${seedIdentity.visitor_id}`
            )
            const instAi = await createInsightsInstance(uuidv7(), {
                before_send: beforeSendMock,
                capture_pageview: false,
            })
            expect(instAi.getCrossDomainIdentity()).toEqual(seedIdentity)

            // Non-Hanzo external links are never decorated
            expect(instAi.decorateCrossDomainUrl('https://external.example.com/blog')).toBe(
                'https://external.example.com/blog'
            )

            // Walk all 4 downstream domain hops
            const hops = [
                'https://hanzo.app/signup',
                'https://hanzo.bot/agents/launch',
                'https://hanzo.team/org/create',
                'https://platform.hanzo.ai/dev/my-app',
            ]

            let prevInst: Insights = instAi
            const visitedHosts: string[] = ['hanzo.ai']
            const observedVisitorIds = new Set<string>([instAi.getCrossDomainIdentity().visitor_id!])
            const observedAids = new Set<string>([instAi.getCrossDomainIdentity().hz_aid!])
            const observedSids = new Set<string>([instAi.getCrossDomainIdentity().hz_sid!])

            for (const nextUrl of hops) {
                const decorated = prevInst.decorateCrossDomainUrl(nextUrl)
                const parsed = new URL(decorated)
                visitedHosts.push(parsed.hostname)

                const extracted = extractCrossDomainIdentityFromUrl(decorated)
                expect(extracted).toEqual(seedIdentity)

                // Simulate landing on destination domain with incoming decorated query params
                navigatePath(`${parsed.pathname}${parsed.search}`)
                const nextInst = await createInsightsInstance(uuidv7(), {
                    before_send: beforeSendMock,
                    capture_pageview: false,
                })
                const id = nextInst.getCrossDomainIdentity()
                expect(id).toEqual(seedIdentity)
                expect(nextInst.get_distinct_id()).toBe(seedIdentity.visitor_id)

                observedVisitorIds.add(id.visitor_id!)
                observedAids.add(id.hz_aid!)
                observedSids.add(id.hz_sid!)
                prevInst = nextInst
            }

            // All 5 domains stitched to ONE single customer journey
            expect(visitedHosts).toEqual([
                'hanzo.ai',
                'hanzo.app',
                'hanzo.bot',
                'hanzo.team',
                'platform.hanzo.ai',
            ])
            expect(observedVisitorIds.size).toBe(1)
            expect(observedAids.size).toBe(1)
            expect(observedSids.size).toBe(1)
            expect(decorateCrossDomainUrl('https://hanzo.app/pay', seedIdentity)).toContain(
                'hz_aid=hza_journey_999'
            )
        })
    })

    describe('4. Privacy-First Pre-Capture Masking & Route Exclusion', () => {
        it('excludes sensitive auth and payment routes from replay and heatmaps BEFORE capture', async () => {
            const excludedUrls = [
                'https://hanzo.app/auth/callback?code=oauth_secret&state=xyz',
                'https://hanzo.app/oauth/callback',
                'https://hanzo.app/login/callback?token=abc',
                'https://hanzo.app/pay/confirm/card',
                'https://hanzo.app/pay/card/pm_12345',
                'https://hanzo.app/checkout/payment/cs_live_123',
            ]

            for (const url of excludedUrls) {
                expect(isUxCaptureExcludedRoute(url)).toBe(true)
                expect(isHeatmapEligibleRoute(url)).toBe(false)
            }

            // URLTriggerMatching includes DEFAULT_REPLAY_URL_BLOCKLIST out of the box
            const insights = await createInsightsInstance(uuidv7(), {
                before_send: beforeSendMock,
                capture_pageview: false,
            })
            const matcher = new URLTriggerMatching(insights)
            expect(matcher._urlBlocklist.length).toBeGreaterThanOrEqual(DEFAULT_REPLAY_URL_BLOCKLIST.length)

            const onPause = jest.fn()
            const onResume = jest.fn()
            navigatePath('/auth/callback?code=secret')
            matcher.checkUrlBlocklist(onPause, onResume)
            expect(onPause).toHaveBeenCalledTimes(1)

            // SessionRecording refuses to enable on excluded routes even when server config enables it
            insights.persistence?.register({
                [SESSION_RECORDING_REMOTE_CONFIG]: { enabled: true, cache_timestamp: Date.now() },
            })
            expect(insights.sessionRecording?.['_isRecordingEnabled']).toBe(false)

            // Payment confirm route also blocks recording
            navigatePath('/pay/confirm/card')
            expect(insights.sessionRecording?.['_isRecordingEnabled']).toBe(false)

            // Eligible route allows recording
            navigatePath('/dev/my-app')
            expect(insights.sessionRecording?.['_isRecordingEnabled']).toBe(true)
        })

        it('masks password, payment/card/cvv/iban/secret/api-key inputs & sensitive containers before capture in rrweb', async () => {
            expect(combineMaskTextSelectors(undefined)).toBe(SENSITIVE_MASK_TEXT_SELECTOR)
            expect(combineMaskTextSelectors('.custom-mask')).toBe(
                `${SENSITIVE_MASK_TEXT_SELECTOR}, .custom-mask`
            )

            const passwordInput = document.createElement('input')
            passwordInput.type = 'password'

            const cardInput = document.createElement('input')
            cardInput.type = 'text'
            cardInput.name = 'card_number'
            cardInput.setAttribute('autocomplete', 'cc-number')

            const cvvInput = document.createElement('input')
            cvvInput.type = 'text'
            cvvInput.id = 'card-cvv'

            const ibanInput = document.createElement('input')
            ibanInput.type = 'text'
            ibanInput.name = 'iban'

            const apiKeyInput = document.createElement('input')
            apiKeyInput.type = 'text'
            apiKeyInput.name = 'api_key'

            const secretSpan = document.createElement('span')
            secretSpan.setAttribute('data-secret', 'true')

            const maskedContainer = document.createElement('div')
            maskedContainer.setAttribute('data-hanzo-mask', '')
            const maskedChild = document.createElement('p')
            maskedContainer.appendChild(maskedChild)

            const convAttr = document.createElement('div')
            convAttr.setAttribute('data-conversation-body', '')
            const convAttrChild = document.createElement('span')
            convAttr.appendChild(convAttrChild)

            const convClass = document.createElement('div')
            convClass.className = 'chat-box conversation-body'
            const convClassChild = document.createElement('p')
            convClass.appendChild(convClassChild)

            const sensitiveElements = [
                passwordInput,
                cardInput,
                cvvInput,
                ibanInput,
                apiKeyInput,
                secretSpan,
                maskedChild,
                convAttrChild,
                convClassChild,
            ]

            for (const el of sensitiveElements) {
                expect(isSensitiveElement(el)).toBe(true)
                // Even when maskAllInputs=false, sensitive inputs MUST still be masked!
                expect(maskInputValueBeforeCapture('sensitive-val', el, false)).toBe(MASKED_PLACEHOLDER)
                expect(maskTextValueBeforeCapture('sensitive-text', el)).toBe(MASKED_PLACEHOLDER)
            }

            // Benign CTA button is NOT masked
            const ctaButton = document.createElement('button')
            ctaButton.setAttribute('data-control-id', 'cta-deploy')
            ctaButton.textContent = 'Deploy Now'
            expect(isSensitiveElement(ctaButton)).toBe(false)
            expect(maskTextValueBeforeCapture('Deploy Now', ctaButton)).toBe('Deploy Now')

            // Verify LazyLoadedSessionRecording wires pre-capture masking into rrweb.record options
            let capturedRecordOptions: any = null
            const mockStopFn = jest.fn()
            const mockRecord = jest.fn().mockImplementation((opts: any) => {
                capturedRecordOptions = opts
                return mockStopFn
            })
            ;(mockRecord as any).addCustomEvent = jest.fn()
            ;(mockRecord as any).takeFullSnapshot = jest.fn()

            assignableWindow.__InsightsExtensions__ = {
                ...assignableWindow.__InsightsExtensions__,
                rrweb: { record: mockRecord, version: '2.0.0' },
            }

            const insights = await createInsightsInstance(uuidv7(), {
                before_send: beforeSendMock,
                capture_pageview: false,
                session_recording: { maskAllInputs: false },
            })
            insights.persistence?.register({
                [SESSION_RECORDING_REMOTE_CONFIG]: { enabled: true, cache_timestamp: Date.now() },
            })

            const recorder = new LazyLoadedSessionRecording(insights)
            recorder.start()

            expect(capturedRecordOptions).not.toBeNull()
            expect(capturedRecordOptions.maskTextSelector).toContain('[data-hanzo-mask]')
            expect(capturedRecordOptions.maskTextSelector).toContain('[data-conversation-body]')
            expect(capturedRecordOptions.maskTextSelector).toContain('.conversation-body')
            expect(capturedRecordOptions.maskTextSelector).toContain('[data-secret]')

            // Even with maskAllInputs: false, password/card/cvv/iban/api-key are masked pre-capture
            expect(capturedRecordOptions.maskInputFn('4242-secret', cardInput)).toBe(MASKED_PLACEHOLDER)
            expect(capturedRecordOptions.maskInputFn('MyP@ss', passwordInput)).toBe(MASKED_PLACEHOLDER)
            expect(capturedRecordOptions.maskTextFn('Private prompt', convClassChild)).toBe(MASKED_PLACEHOLDER)
            expect(capturedRecordOptions.maskTextFn('Deploy Now', ctaButton)).toBe('Deploy Now')

            // Emit on excluded route is dropped BEFORE buffering
            navigatePath('/auth/callback?code=oauth_secret')
            recorder.onRRwebEmit({
                type: EventType.Meta,
                timestamp: Date.now(),
                data: { href: 'https://hanzo.app/auth/callback?code=oauth_secret', width: 1440, height: 900 },
            })
            expect(recorder['_buffer'].data).toHaveLength(0)

            recorder.stop()
        })
    })

    describe('5. /auth/callback Strictly Routed to Auth Operational Telemetry', () => {
        it('emits auth_callback_outcome with required latency/error schema and blocks UX heatmaps', async () => {
            expect(classifyRouteTelemetry('/auth/callback?code=abc&state=xyz')).toBe('auth_operational')

            const built = buildAuthCallbackOutcome({
                hostname: 'hanzo.app',
                release: '2026.11.20',
                viewportWidth: 390,
                outcome: 'failed',
                latency_ms: 342.4,
                error_code: 'invalid_grant',
            })
            expect(built).toEqual({
                event: AUTH_CALLBACK_OUTCOME_EVENT,
                properties: {
                    hostname: 'hanzo.app',
                    route: AUTH_CALLBACK_CANONICAL_ROUTE,
                    release: '2026.11.20',
                    device_class: 'mobile',
                    outcome: 'failed',
                    latency_ms: 342,
                    error_code: 'invalid_grant',
                    telemetry_channel: 'auth_operational',
                },
            })

            navigatePath('/auth/callback?code=secret&state=xyz')
            const insights = await createInsightsInstance(uuidv7(), {
                before_send: beforeSendMock,
                capture_pageview: false,
                release: '2026.11.20',
            })

            // Attempt UX heatmap click on /auth/callback -> MUST be dropped
            const btn = document.createElement('button')
            btn.setAttribute('data-control-id', 'auth-retry')
            insights.heatmaps?.['_onClick']?.({
                target: btn,
                clientX: 50,
                clientY: 60,
            } as unknown as MouseEvent)
            jest.advanceTimersByTime(insights.heatmaps!.flushIntervalMilliseconds + 1)
            expect(beforeSendMock).not.toHaveBeenCalled()

            // Operational auth telemetry MUST succeed
            insights.captureAuthCallbackOutcome({
                hostname: 'hanzo.app',
                outcome: 'completed',
                latency_ms: 128,
            })
            expect(beforeSendMock).toHaveBeenCalledTimes(1)
            expect(beforeSendMock.mock.lastCall![0]).toMatchObject({
                event: 'auth_callback_outcome',
                properties: {
                    hostname: 'hanzo.app',
                    route: '/auth/callback',
                    release: '2026.11.20',
                    device_class: 'desktop',
                    outcome: 'completed',
                    latency_ms: 128,
                    error_code: null,
                    telemetry_channel: 'auth_operational',
                },
            })
        })
    })

    describe('6. Default-On Aggregate Heatmaps on Eligible Routes', () => {
        it('enables aggregate heatmaps by default on eligible routes with stable control_id keys', async () => {
            navigatePath('/dev/my-agent-project')
            const insights = await createInsightsInstance(uuidv7(), {
                before_send: beforeSendMock,
                capture_pageview: false,
                release: '2026.11.20',
            })

            // Enabled by default without requiring explicit capture_heatmaps: true
            expect(insights.heatmaps?.isEnabled).toBe(true)

            const btnByControlId = document.createElement('button')
            btnByControlId.setAttribute('data-control-id', 'deploy-primary')
            btnByControlId.textContent = 'Deploy'

            const btnByTestId = document.createElement('button')
            btnByTestId.setAttribute('data-testid', 'upgrade-plan-btn')
            btnByTestId.textContent = 'Upgrade'

            const btnSemantic = document.createElement('button')
            btnSemantic.textContent = 'Create API Key'

            expect(resolveStableControlId(btnByControlId)).toBe('deploy-primary')
            expect(resolveStableControlId(btnByTestId)).toBe('upgrade-plan-btn')
            expect(resolveStableControlId(btnSemantic)).toBe('button:create-api-key')

            // Sensitive inputs never emit heatmap control_ids
            const pwdInput = document.createElement('input')
            pwdInput.type = 'password'
            pwdInput.setAttribute('data-control-id', 'pwd')
            expect(resolveStableControlId(pwdInput)).toBeNull()

            // Click twice on deploy button, once on semantic button, once on password input (ignored)
            insights.heatmaps?.['_onClick']?.({
                target: btnByControlId,
                clientX: 100,
                clientY: 200,
            } as unknown as MouseEvent)
            insights.heatmaps?.['_onClick']?.({
                target: btnByControlId,
                clientX: 102,
                clientY: 201,
            } as unknown as MouseEvent)
            insights.heatmaps?.['_onClick']?.({
                target: btnSemantic,
                clientX: 200,
                clientY: 300,
            } as unknown as MouseEvent)
            insights.heatmaps?.['_onClick']?.({
                target: pwdInput,
                clientX: 300,
                clientY: 400,
            } as unknown as MouseEvent)

            jest.advanceTimersByTime(insights.heatmaps!.flushIntervalMilliseconds + 1)

            expect(beforeSendMock).toHaveBeenCalledTimes(1)
            const flushed = beforeSendMock.mock.lastCall![0] as any
            expect(flushed.event).toBe('$$heatmap')
            expect(flushed.properties.$aggregate_heatmap).toEqual([
                {
                    key: {
                        hostname: 'localhost',
                        route_template: '/dev/:project',
                        release: '2026.11.20',
                        viewport: 'desktop',
                        control_id: 'deploy-primary',
                    },
                    count: 2,
                },
                {
                    key: {
                        hostname: 'localhost',
                        route_template: '/dev/:project',
                        release: '2026.11.20',
                        viewport: 'desktop',
                        control_id: 'button:create-api-key',
                    },
                    count: 1,
                },
            ])

            // Excluded route returns null aggregate key
            expect(
                buildAggregateHeatmapKey({
                    hostname: 'hanzo.app',
                    urlOrPath: '/pay/confirm/card',
                    release: '2026.11.20',
                    viewportWidth: 1440,
                    element: btnByControlId,
                })
            ).toBeNull()
        })
    })
})

import {
    captureAstSnapshot,
    captureComponentStep,
    captureScrollDepth,
    detectRageClick,
    trackScrollDepthMilestone,
} from '../hanzo-telemetry'

describe('component steps, AST, rage click, scroll depth', () => {
    const ctx = { hostname: 'hanzo.ai', urlOrPath: '/orders/123456', release: 'r1', viewportWidth: 390 }

    it('captures $component_step with required fields', () => {
        const capture = jest.fn()
        expect(captureComponentStep(capture, { ...ctx, step_index: 2, component_path: 'main>form', control_id: 'btn' })).toBe(true)
        const [name, props] = capture.mock.calls[0] as [string, any]
        expect(name).toBe('$component_step')
        expect(props).toMatchObject({ step_index: 2, component_path: 'main>form', control_id: 'btn', action: 'click', release: 'r1', device_class: 'mobile' })
        expect(props.route_template).toBeTruthy()
        expect(props.hostname).toBeTruthy()
    })

    it('skips excluded routes', () => {
        const capture = jest.fn()
        expect(captureComponentStep(capture, { ...ctx, urlOrPath: '/auth/callback', step_index: 0, component_path: 'x' })).toBe(false)
        expect(captureComponentStep(capture, { ...ctx, urlOrPath: '/pay/card/1', step_index: 0, component_path: 'x' })).toBe(false)
        expect(captureAstSnapshot(capture, document.body, { ...ctx, urlOrPath: '/checkout/payment/1' })).toBe(false)
        expect(capture).not.toHaveBeenCalled()
    })

    it('captures $ast_collected excluding masked containers', () => {
        document.body.innerHTML = `<main data-component="home"><button data-control-id="go">Go</button>
          <div data-hanzo-mask><button data-control-id="secret">S</button></div></main>`
        const capture = jest.fn()
        expect(captureAstSnapshot(capture, document.body, ctx)).toBe(true)
        const [name, props] = capture.mock.calls[0] as [string, any]
        expect(name).toBe('$ast_collected')
        expect(props.controls.map((c: any) => c.control_id)).toContain('go')
        expect(JSON.stringify(props)).not.toContain('secret')
        expect(props.sections.length).toBeGreaterThan(0)
        expect(props.release).toBe('r1')
    })

    it('detects rage clicks', () => {
        const d = detectRageClick()
        expect(d({ x: 10, y: 10, t: 0 })).toBe(false)
        expect(d({ x: 12, y: 11, t: 200 })).toBe(false)
        expect(d({ x: 11, y: 10, t: 400 })).toBe(true)
        expect(d({ x: 11, y: 10, t: 5000 })).toBe(false)
        const far = detectRageClick()
        far({ x: 0, y: 0, t: 0 })
        far({ x: 500, y: 0, t: 100 })
        expect(far({ x: 0, y: 500, t: 200 })).toBe(false)
    })

    it('tracks scroll depth milestones once each', () => {
        const t = trackScrollDepthMilestone()
        expect(t(10)).toEqual([])
        expect(t(30)).toEqual([25])
        expect(t(80)).toEqual([50, 75])
        expect(t(100)).toEqual([100])
        expect(t(100)).toEqual([])
        const capture = jest.fn()
        expect(captureScrollDepth(capture, 50, ctx)).toBe(true)
        expect(capture.mock.calls[0][0]).toBe('scroll_depth')
        expect(captureScrollDepth(capture, 50, { ...ctx, urlOrPath: '/auth/callback' })).toBe(false)
    })
})
