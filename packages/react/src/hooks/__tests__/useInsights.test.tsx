import * as React from 'react'
import { renderHook } from '@testing-library/react'
import { InsightsProvider, Insights } from '../../context'
import { useInsights } from '..'

jest.useFakeTimers()

const insights = { insights_client: true } as unknown as Insights

describe('useInsights hook', () => {
    it('should return the client', () => {
        const { result } = renderHook(() => useInsights(), {
            wrapper: ({ children }: { children: React.ReactNode }) => (
                <InsightsProvider client={insights}>{children}</InsightsProvider>
            ),
        })
        expect(result.current).toEqual(insights)
    })
})
