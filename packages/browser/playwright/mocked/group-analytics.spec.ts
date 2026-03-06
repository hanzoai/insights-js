import { expect, test } from './utils/insights-playwright-test-base'
import { start } from './utils/setup'
import { Insights } from '@/insights-core'

test.describe('group analytics', () => {
    test('includes group information in all event payloads', async ({ page, context }) => {
        await start(
            {
                runBeforeInsightsInit: async (page) => {
                    // it's tricky to pass functions as args the way insights config is passed in playwright
                    // so here we set the function on the window object
                    // and then call it in the loaded function during init
                    await page.evaluate(() => {
                        ;(window as any).__ph_loaded = (ph: Insights) => {
                            ph.group('company', 'id:5')
                        }
                    })
                },
            },
            page,
            context
        )

        await page.locator('[data-cy-custom-event-button]').click()

        const capturedEvents = await page.capturedEvents()
        expect(capturedEvents).toHaveLength(3)
        const hasGroups = new Set(capturedEvents.map((x) => !!x.properties.$groups))
        expect(hasGroups).toEqual(new Set([true]))
    })
})
