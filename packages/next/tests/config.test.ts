import { DEFAULT_API_HOST } from '../src/shared/constants'
import { normalizeConfigValue, resolveApiKey, resolveHostOrDefault } from '../src/shared/config'

describe('shared config', () => {
    const originalEnv = process.env

    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...originalEnv }
        delete process.env.NEXT_PUBLIC_INSIGHTS_KEY
        delete process.env.NEXT_PUBLIC_INSIGHTS_HOST
    })

    afterAll(() => {
        process.env = originalEnv
    })

    it('normalizes strings and returns undefined for non-strings', () => {
        expect(normalizeConfigValue('  phc_test123\n')).toBe('phc_test123')
        expect(normalizeConfigValue('   ')).toBeUndefined()
        expect(normalizeConfigValue(undefined)).toBeUndefined()
        expect(normalizeConfigValue(null)).toBeUndefined()
        expect(normalizeConfigValue(123)).toBeUndefined()
        expect(normalizeConfigValue({ value: 'phc_test123' })).toBeUndefined()
    })

    it('warns and returns undefined when apiKey is not a string and no env fallback exists', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

        expect(resolveApiKey({ value: 'phc_test123' })).toBeUndefined()

        expect(warnSpy).toHaveBeenCalledWith('[Insights Next.js] apiKey is required — Insights will not be initialized')
        warnSpy.mockRestore()
    })

    it('falls back to env apiKey when explicit apiKey is not a string', () => {
        process.env.NEXT_PUBLIC_INSIGHTS_KEY = '  phc_from_env\n'

        expect(resolveApiKey({ value: 'phc_test123' })).toBe('phc_from_env')
    })

    it('uses the default host when explicit and env hosts are not strings', () => {
        process.env.NEXT_PUBLIC_INSIGHTS_HOST = ''

        expect(resolveHostOrDefault({ value: 'https://custom.insights.hanzo.ai' })).toBe(DEFAULT_API_HOST)
    })
})
