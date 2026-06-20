import { expect, test } from './utils/insights-playwright-test-base'
import { start } from './utils/setup'

test.describe('debug mode persistence', () => {
    test('debug mode persists across page reload via localStorage', async ({ page, context }) => {
        await start(
            {
                options: {},
                url: '/playground/cypress/index.html',
            },
            page,
            context
        )

        await page.evaluate(() => {
            const win = window as any
            win.insights?.debug()
        })

        const storedValue = await page.evaluate(() => localStorage.getItem('hi_debug'))
        expect(storedValue).not.toBeNull()

        await start(
            {
                options: { debug: undefined },
                type: 'reload',
                url: '/playground/cypress/index.html',
            },
            page,
            context
        )

        const debugAfterReload = await page.evaluate(() => {
            const win = window as any
            return win.insights?.config?.debug
        })
        expect(debugAfterReload).toBe(true)
    })
})
