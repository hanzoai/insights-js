import { isNullish, isNumber, isObject, isString } from '@hanzo/insights-core'
import type { Properties, SessionRecordingUrlTrigger } from './types'

export const DEVICE_CLASSES = ['mobile', 'tablet', 'desktop'] as const
export type DeviceClass = (typeof DEVICE_CLASSES)[number]

export const FUNNEL_OUTCOMES = ['started', 'completed', 'canceled', 'failed'] as const
export type FunnelOutcome = (typeof FUNNEL_OUTCOMES)[number]

export const CONFIRMED_PAYMENT_EVENT = 'checkout_completed' as const
export const AUTH_CALLBACK_OUTCOME_EVENT = 'auth_callback_outcome' as const
export const AUTH_CALLBACK_CANONICAL_ROUTE = '/auth/callback' as const

export const TRUSTED_PAYMENT_CONFIRMATION_SOURCES = [
    'server',
    'webhook',
    's2s',
    'stripe_webhook',
    'commerce_webhook',
] as const

export const HANZO_ECOSYSTEM_DOMAINS = [
    'hanzo.ai',
    'hanzo.app',
    'hanzo.bot',
    'hanzo.team',
    'platform.hanzo.ai',
] as const

const HANZO_ROOT_DOMAINS = ['hanzo.ai', 'hanzo.app', 'hanzo.bot', 'hanzo.team'] as const

export const EXCLUDED_UX_CAPTURE_ROUTE_PATTERNS: readonly RegExp[] = [
    /^\/auth\/callback(?:\/|$)/i,
    /^\/oauth\/callback(?:\/|$)/i,
    /^\/login\/callback(?:\/|$)/i,
    /^\/pay\/confirm(?:\/|$)/i,
    /^\/pay\/card(?:\/|$)/i,
    /^\/checkout\/payment(?:\/|$)/i,
]

export const AUTH_CALLBACK_ROUTE_PATTERNS: readonly RegExp[] = [
    /^\/auth\/callback(?:\/|$)/i,
    /^\/oauth\/callback(?:\/|$)/i,
    /^\/login\/callback(?:\/|$)/i,
]

export const DEFAULT_REPLAY_URL_BLOCKLIST: readonly SessionRecordingUrlTrigger[] = [
    { url: '(/|^)(auth|oauth|login)/callback(/|\\?|#|$)', matching: 'regex' },
    { url: '(/|^)pay/(confirm|card)(/|\\?|#|$)', matching: 'regex' },
    { url: '(/|^)checkout/payment(/|\\?|#|$)', matching: 'regex' },
]

export const SENSITIVE_MASK_TEXT_SELECTOR =
    '[data-hanzo-mask], [data-conversation-body], .conversation-body, [data-secret]'

export const SENSITIVE_INPUT_FIELD_PATTERN =
    /(password|passcode|passwd|card|cc[-_]?num|cc[-_]?exp|cc[-_]?csc|credit[-_]?card|cardnumber|\bpan\b|cvv|cvc|csc|security[-_]?code|iban|routing|bank[-_]?account|account[-_]?num|swift|bic|secret|api[-_]?key|apikey|access[-_]?key|private[-_]?key|client[-_]?secret|auth[-_]?token|bearer)/i

export const MASKED_PLACEHOLDER = '********'

const UUID_SEGMENT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NUMERIC_SEGMENT_RE = /^\d+$/
const LONG_HEX_SEGMENT_RE = /^[0-9a-f]{16,}$/i
const OPAQUE_ID_SEGMENT_RE = /^(?:pi|cs|ch|pm|cus|sub|sess|ord|inv|tok|pay|tx|usr|org|prj)_[a-zA-Z0-9_-]{4,}$/i

const SEMANTIC_INTERACTIVE_TAGS = new Set(['button', 'a', 'summary'])
const SEMANTIC_INTERACTIVE_ROLES = new Set(['button', 'link', 'tab', 'menuitem', 'switch'])
const DYNAMIC_ID_PATTERN =
    /^(?:[0-9a-f]{8,}|[0-9a-f]{8}-[0-9a-f]{4}-|radix-|headlessui-|react-aria-|:r[0-9a-z]+:)/i

export type RouteTelemetryChannel = 'auth_operational' | 'payment_excluded' | 'ux_eligible'

export function extractPathname(urlOrPath?: string | null): string {
    if (!urlOrPath || !isString(urlOrPath)) {
        return '/'
    }
    const trimmed = urlOrPath.trim()
    if (!trimmed) {
        return '/'
    }
    try {
        // eslint-disable-next-line compat/compat
        const parsed = new URL(trimmed, 'https://hanzo.ai')
        const collapsed = parsed.pathname.replace(/\/{2,}/g, '/')
        if (collapsed.length > 1 && collapsed.endsWith('/')) {
            return collapsed.slice(0, -1)
        }
        return collapsed || '/'
    } catch {
        const noQuery = trimmed.split(/[?#]/)[0] || '/'
        const normalized = noQuery.startsWith('/') ? noQuery : '/' + noQuery
        const collapsed = normalized.replace(/\/{2,}/g, '/')
        return collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed
    }
}

export function normalizeHostname(rawHostname?: string | null): string {
    if (!rawHostname || !isString(rawHostname)) {
        return 'unknown'
    }
    const trimmed = rawHostname.trim().toLowerCase()
    if (!trimmed) {
        return 'unknown'
    }
    try {
        if (trimmed.indexOf('://') !== -1) {
            // eslint-disable-next-line compat/compat
            return new URL(trimmed).hostname.toLowerCase().replace(/^www\./, '')
        }
    } catch {
        // fall through
    }
    return trimmed.replace(/:\d+$/, '').replace(/^www\./, '')
}

export function isAuthCallbackRoute(urlOrPath?: string | null): boolean {
    const pathname = extractPathname(urlOrPath)
    return AUTH_CALLBACK_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
}

export function isUxCaptureExcludedRoute(urlOrPath?: string | null): boolean {
    const pathname = extractPathname(urlOrPath)
    return EXCLUDED_UX_CAPTURE_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
}

export function isHeatmapEligibleRoute(urlOrPath?: string | null): boolean {
    return !isUxCaptureExcludedRoute(urlOrPath)
}

export function classifyRouteTelemetry(urlOrPath?: string | null): RouteTelemetryChannel {
    if (isAuthCallbackRoute(urlOrPath)) {
        return 'auth_operational'
    }
    if (isUxCaptureExcludedRoute(urlOrPath)) {
        return 'payment_excluded'
    }
    return 'ux_eligible'
}

export function normalizeRouteTemplate(rawUrlOrPath?: string | null): string {
    const pathname = extractPathname(rawUrlOrPath)
    if (pathname === '/') {
        return '/'
    }

    const segments = pathname.split('/').filter(Boolean)
    const normalized: string[] = []

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const lower = seg.toLowerCase()
        const prev = i > 0 ? segments[i - 1].toLowerCase() : ''
        const prev2 = i > 1 ? segments[i - 2].toLowerCase() : ''

        if (seg.startsWith(':')) {
            normalized.push(seg)
            continue
        }

        if ((prev === 'auth' || prev === 'oauth' || prev === 'login') && lower === 'callback') {
            normalized.push('callback')
            continue
        }

        if (prev2 === 'pay' && prev === 'confirm') {
            normalized.push(':method')
            continue
        }

        if ((prev2 === 'pay' && prev === 'card') || (prev2 === 'checkout' && prev === 'payment')) {
            normalized.push(':id')
            continue
        }

        if ((prev === 'dev' || prev === 'projects') && !['new', 'create', 'settings'].includes(lower)) {
            normalized.push(':project')
            continue
        }

        if ((prev === 'org' || prev === 'orgs') && !['new', 'create'].includes(lower)) {
            normalized.push(':org')
            continue
        }

        if ((prev === 'team' || prev === 'teams') && !['new', 'create'].includes(lower)) {
            normalized.push(':team')
            continue
        }

        if (
            UUID_SEGMENT_RE.test(seg) ||
            NUMERIC_SEGMENT_RE.test(seg) ||
            LONG_HEX_SEGMENT_RE.test(seg) ||
            OPAQUE_ID_SEGMENT_RE.test(seg)
        ) {
            normalized.push(':id')
            continue
        }

        normalized.push(seg)
    }

    return '/' + normalized.join('/')
}

export function classifyDeviceClass(input: { width?: number | null; userAgent?: string | null }): DeviceClass {
    if (isNumber(input.width) && isFinite(input.width) && input.width > 0) {
        if (input.width < 768) return 'mobile'
        if (input.width < 1024) return 'tablet'
        return 'desktop'
    }

    const ua = (input.userAgent || '').toLowerCase()
    if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) {
        return 'tablet'
    }
    if (/iphone|ipod|android.*mobile|blackberry|iemobile|opera mini|mobile/i.test(ua)) {
        return 'mobile'
    }
    return 'desktop'
}

export function combineMaskTextSelectors(userSelector?: string | null): string {
    if (!userSelector || !isString(userSelector) || !userSelector.trim()) {
        return SENSITIVE_MASK_TEXT_SELECTOR
    }
    const trimmed = userSelector.trim()
    if (trimmed === '*') {
        return '*'
    }
    return `${SENSITIVE_MASK_TEXT_SELECTOR}, ${trimmed}`
}

export function isSensitiveElement(el: unknown): boolean {
    if (!el || !isObject(el)) {
        return false
    }

    const node = el as {
        tagName?: string
        type?: string
        name?: string
        id?: string
        className?: string
        getAttribute?: (name: string) => string | null
        hasAttribute?: (name: string) => boolean
        closest?: (selector: string) => unknown
    }

    if (typeof node.closest === 'function') {
        try {
            if (node.closest(SENSITIVE_MASK_TEXT_SELECTOR)) {
                return true
            }
        } catch {
            // ignore selector failures on non-Element targets
        }
    }

    const hasMarkerAttr = (attrName: string): boolean => {
        if (typeof node.hasAttribute === 'function') {
            return node.hasAttribute(attrName)
        }
        if (typeof node.getAttribute === 'function') {
            return !isNullish(node.getAttribute(attrName))
        }
        return false
    }

    if (
        hasMarkerAttr('data-hanzo-mask') ||
        hasMarkerAttr('data-conversation-body') ||
        hasMarkerAttr('data-secret')
    ) {
        return true
    }

    const className = isString(node.className)
        ? node.className
        : typeof node.getAttribute === 'function'
          ? node.getAttribute('class') || ''
          : ''
    if (className && /(?:^|\s)conversation-body(?:\s|$)/i.test(className)) {
        return true
    }

    const typeAttr = (
        (isString(node.type) ? node.type : '') ||
        (typeof node.getAttribute === 'function' ? node.getAttribute('type') || '' : '')
    ).toLowerCase()
    if (typeAttr === 'password') {
        return true
    }

    const tag = (node.tagName || '').toLowerCase()
    if (tag && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        return false
    }

    const read = (attr: string): string =>
        typeof node.getAttribute === 'function' ? node.getAttribute(attr) || '' : ''

    const candidates = [
        isString(node.name) ? node.name : '',
        isString(node.id) ? node.id : '',
        className,
        read('name'),
        read('id'),
        read('autocomplete'),
        read('placeholder'),
        read('aria-label'),
        read('data-testid'),
        read('data-control-id'),
        read('data-field'),
    ].filter(Boolean)

    return candidates.some((c) => SENSITIVE_INPUT_FIELD_PATTERN.test(c))
}

export function maskInputValueBeforeCapture(
    value: string,
    element?: HTMLElement | unknown,
    maskAllInputs = true
): string {
    if (!value) {
        return value
    }
    if (maskAllInputs || isSensitiveElement(element)) {
        return MASKED_PLACEHOLDER
    }
    return value
}

export function maskTextValueBeforeCapture(text: string, element?: HTMLElement | unknown): string {
    if (!text) {
        return text
    }
    if (isSensitiveElement(element)) {
        return MASKED_PLACEHOLDER
    }
    return text
}

export interface FunnelStepInput {
    hostname: string
    route: string
    release?: string | null
    device_class?: DeviceClass
    viewportWidth?: number
    userAgent?: string
    outcome: FunnelOutcome
    properties?: Properties
}

export interface FunnelStepProperties extends Properties {
    hostname: string
    route: string
    release: string
    device_class: DeviceClass
    outcome: FunnelOutcome
}

export function buildFunnelStepProperties(input: FunnelStepInput): FunnelStepProperties {
    if (!FUNNEL_OUTCOMES.includes(input.outcome)) {
        throw new Error(`Invalid funnel outcome: ${String(input.outcome)}`)
    }

    const deviceClass =
        input.device_class ??
        classifyDeviceClass({
            width: input.viewportWidth,
            userAgent: input.userAgent,
        })

    if (!DEVICE_CLASSES.includes(deviceClass)) {
        throw new Error(`Invalid device_class: ${String(deviceClass)}`)
    }

    return {
        ...(input.properties || {}),
        hostname: normalizeHostname(input.hostname),
        route: normalizeRouteTemplate(input.route),
        release: (input.release && input.release.trim()) || 'unknown',
        device_class: deviceClass,
        outcome: input.outcome,
    }
}

export function isConfirmedServerPaymentEvent(eventName?: string | null, properties?: Properties | null): boolean {
    if (!eventName || !properties || !isObject(properties)) {
        return false
    }
    if (eventName.trim().toLowerCase() !== CONFIRMED_PAYMENT_EVENT) {
        return false
    }
    if (properties.confirmed_by !== 'server') {
        return false
    }
    const source = isString(properties.source) ? properties.source.toLowerCase() : ''
    if (source === 'client' || source === 'client_redirect' || source === 'redirect') {
        return false
    }
    if (isString(properties.confirmation_source)) {
        const cs = properties.confirmation_source.toLowerCase()
        if (!TRUSTED_PAYMENT_CONFIRMATION_SOURCES.includes(cs as any)) {
            return false
        }
    }
    if (!isNullish(properties.outcome) && properties.outcome !== 'completed') {
        return false
    }
    return true
}

/**
 * Browser SDK guard: client-side code must NEVER emit `confirmed_by: 'server'` on payment events.
 * Client redirects are explicitly downgraded to `confirmed_by: 'client'` with `payment_counted: false`.
 */
export function enforceClientPaymentGuard(eventName: string, properties: Properties): Properties {
    const normalized = (eventName || '').trim().toLowerCase()
    const isPaymentEvent =
        normalized === CONFIRMED_PAYMENT_EVENT ||
        normalized === 'checkout_redirect_return' ||
        normalized === 'payment_success'

    if (!isPaymentEvent) {
        return properties
    }

    const sanitized: Properties = { ...properties }
    if (sanitized.confirmed_by === 'server' || isNullish(sanitized.confirmed_by)) {
        sanitized.confirmed_by = 'client'
    }
    sanitized.payment_counted = false
    return sanitized
}

export interface ConfirmedServerPaymentInput {
    hostname: string
    route: string
    release?: string | null
    device_class: DeviceClass
    confirmation_source?: (typeof TRUSTED_PAYMENT_CONFIRMATION_SOURCES)[number]
    revenue?: number
    currency?: string
    hz_aid?: string
    hz_sid?: string
    visitor_id?: string
    properties?: Properties
}

export function buildConfirmedServerPaymentEvent(input: ConfirmedServerPaymentInput): {
    event: typeof CONFIRMED_PAYMENT_EVENT
    properties: FunnelStepProperties & {
        confirmed_by: 'server'
        confirmation_source: string
    }
} {
    const base = buildFunnelStepProperties({
        hostname: input.hostname,
        route: input.route,
        release: input.release,
        device_class: input.device_class,
        outcome: 'completed',
        properties: {
            ...(input.properties || {}),
            ...(isNumber(input.revenue) ? { revenue: input.revenue } : {}),
            ...(input.currency ? { currency: input.currency.toUpperCase() } : {}),
            ...(input.hz_aid ? { hz_aid: input.hz_aid } : {}),
            ...(input.hz_sid ? { hz_sid: input.hz_sid } : {}),
            ...(input.visitor_id ? { visitor_id: input.visitor_id } : {}),
        },
    })

    return {
        event: CONFIRMED_PAYMENT_EVENT,
        properties: {
            ...base,
            confirmed_by: 'server',
            confirmation_source: input.confirmation_source || 'webhook',
        },
    }
}

export function countConfirmedPayments(events: Array<{ event: string; properties?: Properties | null }>): number {
    let count = 0
    for (const item of events) {
        if (isConfirmedServerPaymentEvent(item.event, item.properties)) {
            count += 1
        }
    }
    return count
}

export interface AuthCallbackOutcomeInput {
    hostname: string
    release?: string | null
    device_class?: DeviceClass
    viewportWidth?: number
    userAgent?: string
    outcome: FunnelOutcome
    latency_ms: number
    error_code?: string | null
}

export interface AuthCallbackOutcomeProperties extends Properties {
    hostname: string
    route: typeof AUTH_CALLBACK_CANONICAL_ROUTE
    release: string
    device_class: DeviceClass
    outcome: FunnelOutcome
    latency_ms: number
    error_code: string | null
    telemetry_channel: 'auth_operational'
}

export function buildAuthCallbackOutcome(input: AuthCallbackOutcomeInput): {
    event: typeof AUTH_CALLBACK_OUTCOME_EVENT
    properties: AuthCallbackOutcomeProperties
} {
    const deviceClass =
        input.device_class ??
        classifyDeviceClass({
            width: input.viewportWidth,
            userAgent: input.userAgent,
        })

    const errorCode =
        input.outcome === 'completed' || input.outcome === 'started'
            ? null
            : (input.error_code && input.error_code.trim()) || 'auth_callback_error'

    return {
        event: AUTH_CALLBACK_OUTCOME_EVENT,
        properties: {
            hostname: normalizeHostname(input.hostname),
            route: AUTH_CALLBACK_CANONICAL_ROUTE,
            release: (input.release && input.release.trim()) || 'unknown',
            device_class: deviceClass,
            outcome: input.outcome,
            latency_ms: Math.max(0, Math.round(isNumber(input.latency_ms) && isFinite(input.latency_ms) ? input.latency_ms : 0)),
            error_code: errorCode,
            telemetry_channel: 'auth_operational',
        },
    }
}

export interface CrossDomainIdentity {
    hz_aid?: string
    hz_sid?: string
    visitor_id?: string
}

export function isHanzoEcosystemHost(rawHostOrUrl?: string | null): boolean {
    if (!rawHostOrUrl) {
        return false
    }
    const host = normalizeHostname(rawHostOrUrl)
    return HANZO_ROOT_DOMAINS.some((root) => host === root || host.endsWith('.' + root))
}

function cleanIdentityToken(value: unknown): string | undefined {
    if (!isString(value)) {
        return undefined
    }
    const trimmed = value.trim()
    if (!trimmed || trimmed.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(trimmed)) {
        return undefined
    }
    return trimmed
}

export function extractCrossDomainIdentityFromUrl(urlOrSearch?: string | null): CrossDomainIdentity {
    if (!urlOrSearch || !isString(urlOrSearch)) {
        return {}
    }
    try {
        // eslint-disable-next-line compat/compat
        const parsed = urlOrSearch.startsWith('?')
            ? new URL('https://hanzo.ai/' + urlOrSearch)
            : new URL(urlOrSearch, 'https://hanzo.ai')
        const hz_aid = cleanIdentityToken(parsed.searchParams.get('hz_aid'))
        const hz_sid = cleanIdentityToken(parsed.searchParams.get('hz_sid'))
        const visitor_id = cleanIdentityToken(parsed.searchParams.get('visitor_id')) || hz_aid
        return {
            ...(hz_aid ? { hz_aid } : {}),
            ...(hz_sid ? { hz_sid } : {}),
            ...(visitor_id ? { visitor_id } : {}),
        }
    } catch {
        return {}
    }
}

export function decorateCrossDomainUrl(targetUrl: string, identity: CrossDomainIdentity): string {
    try {
        // eslint-disable-next-line compat/compat
        const parsed = new URL(targetUrl)
        if (!isHanzoEcosystemHost(parsed.hostname)) {
            return targetUrl
        }
        const hzAid = cleanIdentityToken(identity.hz_aid)
        const hzSid = cleanIdentityToken(identity.hz_sid)
        const visitorId = cleanIdentityToken(identity.visitor_id) || hzAid

        if (hzAid && !parsed.searchParams.has('hz_aid')) {
            parsed.searchParams.set('hz_aid', hzAid)
        }
        if (hzSid && !parsed.searchParams.has('hz_sid')) {
            parsed.searchParams.set('hz_sid', hzSid)
        }
        if (visitorId && !parsed.searchParams.has('visitor_id')) {
            parsed.searchParams.set('visitor_id', visitorId)
        }
        return parsed.toString()
    } catch {
        return targetUrl
    }
}

export interface AggregateHeatmapKey {
    hostname: string
    route_template: string
    release: string
    viewport: DeviceClass
    control_id: string
}

function slugifyControlLabel(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64)
}

export function resolveStableControlId(el: Element | null | undefined): string | null {
    if (!el || isSensitiveElement(el)) {
        return null
    }

    // Walk up briefly to the closest labeled/interactive control if target is an inner icon/span
    let candidate: Element | null = el
    if (typeof el.closest === 'function') {
        const interactive = el.closest(
            '[data-control-id], [data-testid], [data-hanzo-control], [data-hanzo-event], button, a, [role="button"], [role="link"], [role="tab"]'
        )
        if (interactive) {
            if (isSensitiveElement(interactive)) {
                return null
            }
            candidate = interactive
        }
    }

    const read = (attr: string): string =>
        typeof candidate?.getAttribute === 'function' ? (candidate.getAttribute(attr) || '').trim() : ''

    const controlId = read('data-control-id')
    if (controlId) {
        return controlId.slice(0, 160)
    }

    const testId = read('data-testid')
    if (testId) {
        return testId.slice(0, 160)
    }

    const hanzoControl = read('data-hanzo-control') || read('data-hanzo-event')
    if (hanzoControl) {
        return hanzoControl.slice(0, 160)
    }

    const tag = (candidate.tagName || '').toLowerCase()
    const role = read('role').toLowerCase()
    const type = read('type').toLowerCase()

    const isSemanticControl =
        SEMANTIC_INTERACTIVE_TAGS.has(tag) ||
        SEMANTIC_INTERACTIVE_ROLES.has(role) ||
        (tag === 'input' && (type === 'submit' || type === 'button'))

    if (!isSemanticControl) {
        return null
    }

    const prefix = role || tag || 'control'
    const ariaLabel = read('aria-label')
    if (ariaLabel) {
        const slug = slugifyControlLabel(ariaLabel)
        if (slug) return `${prefix}:${slug}`
    }

    const id = (candidate.id || read('id')).trim()
    if (id && !DYNAMIC_ID_PATTERN.test(id)) {
        return `${prefix}#${id.slice(0, 120)}`
    }

    const name = read('name')
    if (name) {
        const slug = slugifyControlLabel(name)
        if (slug) return `${prefix}[name=${slug}]`
    }

    const text = (candidate.textContent || '').trim()
    if (text) {
        const slug = slugifyControlLabel(text)
        if (slug) return `${prefix}:${slug}`
    }

    return null
}

export function buildAggregateHeatmapKey(input: {
    hostname: string
    urlOrPath: string
    release?: string | null
    viewportWidth?: number
    userAgent?: string
    element?: Element | null
    control_id?: string | null
}): AggregateHeatmapKey | null {
    if (!isHeatmapEligibleRoute(input.urlOrPath)) {
        return null
    }

    const controlId =
        (isString(input.control_id) && input.control_id.trim()) || resolveStableControlId(input.element)
    if (!controlId) {
        return null
    }

    return {
        hostname: normalizeHostname(input.hostname),
        route_template: normalizeRouteTemplate(input.urlOrPath),
        release: (input.release && input.release.trim()) || 'unknown',
        viewport: classifyDeviceClass({
            width: input.viewportWidth,
            userAgent: input.userAgent,
        }),
        control_id: controlId.slice(0, 160),
    }
}

export function serializeAggregateHeatmapKey(key: AggregateHeatmapKey): string {
    return [key.hostname, key.route_template, key.release, key.viewport, key.control_id].join('|')
}
