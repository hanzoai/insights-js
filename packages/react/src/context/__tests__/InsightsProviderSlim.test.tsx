import * as React from 'react'
import { render } from '@testing-library/react'
import { InsightsProvider } from '../InsightsProviderSlim'
import { InsightsContext } from '../InsightsContext'
import type { Insights } from '@hanzo/insights'

// Do NOT call setDefaultInsightsInstance — this simulates the slim bundle
// where no default instance exists.

let contextClient: Insights | undefined

function ClientConsumer() {
    const { client } = React.useContext(InsightsContext)
    contextClient = client
    return <div>consumed</div>
}

describe('InsightsProvider (slim)', () => {
    afterEach(() => {
        contextClient = undefined
    })

    it('renders children', () => {
        const client = { config: {} } as unknown as Insights
        const { getByText } = render(
            <InsightsProvider client={client}>
                <div>Hello</div>
            </InsightsProvider>
        )
        expect(getByText('Hello')).toBeTruthy()
    })

    it('provides the exact client instance via context', () => {
        const client = { config: {} } as unknown as Insights
        render(
            <InsightsProvider client={client}>
                <ClientConsumer />
            </InsightsProvider>
        )
        expect(contextClient).toBe(client)
    })

    it('provides bootstrap from client config', () => {
        const bootstrap = { featureFlags: { 'test-flag': true } }
        const client = { config: { bootstrap } } as unknown as Insights

        function BootstrapConsumer() {
            const { bootstrap: ctx } = React.useContext(InsightsContext)
            return <div data-testid="bootstrap">{JSON.stringify(ctx)}</div>
        }

        const { getByTestId } = render(
            <InsightsProvider client={client}>
                <BootstrapConsumer />
            </InsightsProvider>
        )
        expect(JSON.parse(getByTestId('bootstrap').textContent!)).toEqual(bootstrap)
    })
})
