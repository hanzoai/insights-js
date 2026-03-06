export * from '../exports'

import ErrorTracking from '../extensions/error-tracking'
import { InsightsBackendClient } from '../client'
import { ErrorTracking as CoreErrorTracking } from '@hanzo/insights-core'

ErrorTracking.errorPropertiesBuilder = new CoreErrorTracking.ErrorPropertiesBuilder(
  [
    new CoreErrorTracking.EventCoercer(),
    new CoreErrorTracking.ErrorCoercer(),
    new CoreErrorTracking.ObjectCoercer(),
    new CoreErrorTracking.StringCoercer(),
    new CoreErrorTracking.PrimitiveCoercer(),
  ],
  CoreErrorTracking.createStackParser('node:javascript', CoreErrorTracking.nodeStackLineParser)
)

export class Insights extends InsightsBackendClient {
  getLibraryId(): string {
    return 'insights-edge'
  }

  protected initializeContext(): undefined {
    return undefined
  }
}
