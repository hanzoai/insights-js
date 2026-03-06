import { createTestClient, InsightsCoreTestClient, InsightsCoreTestClientMocks } from '@/testing'

describe('Insights Core', () => {
  let insights: InsightsCoreTestClient
  let logSpy: jest.SpyInstance

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    ;[insights] = createTestClient('TEST_API_KEY', {})
  })

  describe('debug', () => {
    it('should log emitted events when enabled', () => {
      insights.capture('test-event1')
      expect(logSpy).toHaveBeenCalledTimes(0)

      insights.debug()
      insights.capture('test-event1')
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledWith(
        '[Insights]',
        'capture',
        expect.objectContaining({
          event: 'test-event1',
        })
      )

      logSpy.mockReset()
      insights.debug(false)
      insights.capture('test-event1')
      expect(logSpy).toHaveBeenCalledTimes(0)
    })
  })
})
