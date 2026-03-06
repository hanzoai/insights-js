import { FlushedSizeTracker } from '../../../extensions/replay/external/flushed-size-tracker'
import { Insights } from '../../../insights-core'
import { jest } from '@jest/globals'
import { InsightsPersistence } from '../../../insights-persistence'
import { createMockInsights, createMockConfig } from '../../helpers/insights-instance'

describe('FlushedSizeTracker', () => {
    let mockInsights: Insights
    let tracker: FlushedSizeTracker
    let persistence: InsightsPersistence

    beforeEach(() => {
        persistence = new InsightsPersistence(
            createMockConfig({
                persistence: 'memory',
            }),
            false
        )

        // Bind methods to preserve this context
        persistence.get_property = persistence.get_property.bind(persistence)
        persistence.set_property = persistence.set_property.bind(persistence)

        mockInsights = createMockInsights({
            get_property: persistence.get_property,
            persistence,
        })

        tracker = new FlushedSizeTracker(mockInsights)
    })

    afterEach(() => {
        persistence.clear()
        jest.clearAllMocks()
    })

    describe('constructor', () => {
        it('successfully constructs when persistence is present', () => {
            expect(tracker).toBeInstanceOf(FlushedSizeTracker)
        })

        it('throws error when persistence is missing', () => {
            const invalidInsights = createMockInsights({
                get_property: () => {},
                persistence: undefined,
            })

            expect(() => new FlushedSizeTracker(invalidInsights)).toThrow(
                'it is not valid to not have persistence and be this far into setting up the application'
            )
        })

        it('throws error when persistence is null', () => {
            const invalidInsights = createMockInsights({
                get_property: () => {},
                persistence: null,
            })

            expect(() => new FlushedSizeTracker(invalidInsights)).toThrow(
                'it is not valid to not have persistence and be this far into setting up the application'
            )
        })
    })

    describe('trackSize', () => {
        describe.each([
            [[100, 200, 300], 600],
            [[1, 1, 1, 1, 1], 5],
            [[1000], 1000],
            [[50.5, 25.25, 10.25], 86],
            [[0, 0, 100], 100],
        ])('tracking multiple sizes %p', (sizes, expectedTotal) => {
            it(`accumulates to ${expectedTotal}`, () => {
                sizes.forEach((size) => tracker.trackSize(size))
                expect(tracker.currentTrackedSize).toEqual(expectedTotal)
            })
        })
    })

    describe('reset', () => {
        it('sets property to 0', () => {
            tracker.reset()

            expect(tracker.currentTrackedSize).toEqual(0)
        })

        describe.each([
            [0, 'already zero'],
            [100, 'has tracked data'],
            [999999, 'has large tracked data'],
            [-50, 'has negative value'],
        ])('when current value is %i (%s)', (currentValue) => {
            it('sets property to 0 regardless of current value', () => {
                tracker.trackSize(currentValue)
                expect(tracker.currentTrackedSize).toEqual(currentValue)

                tracker.reset()
                expect(tracker.currentTrackedSize).toEqual(0)
            })
        })
    })
})
