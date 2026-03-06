import * as React from 'react'
import { render } from '@testing-library/react'
import { InsightsProvider, Insights } from '..'

describe('InsightsContext component', () => {
    const insights = {} as unknown as Insights

    it('should return a client instance from the context if available', () => {
        render(
            <InsightsProvider client={insights}>
                <div>Hello</div>
            </InsightsProvider>
        )
    })

    it("should not throw error if a client instance can't be found in the context", () => {
        // eslint-disable-next-line no-console
        console.warn = jest.fn()

        expect(() => {
            render(
                // we have to cast `as any` so that we can test for when
                // insights might not exist - in SSR for example
                <InsightsProvider client={undefined as any}>
                    <div>Hello</div>
                </InsightsProvider>
            )
        }).not.toThrow()

        // eslint-disable-next-line no-console
        expect(console.warn).toHaveBeenCalledWith(
            '[Insights] No `apiKey` or `client` were provided to `InsightsProvider`. Using default global instance. You must initialize it manually. This is not recommended behavior.'
        )
    })
})
