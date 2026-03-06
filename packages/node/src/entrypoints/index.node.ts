export * from '../exports'

import { createModulerModifier } from '../extensions/error-tracking/modifiers/module.node'
import { addSourceContext } from '../extensions/error-tracking/modifiers/context-lines.node'
import ErrorTracking from '../extensions/error-tracking'

import { InsightsBackendClient } from '../client'
import { ErrorTracking as CoreErrorTracking } from '@hanzo/insights-core'
import { InsightsContext } from '../extensions/context/context'

ErrorTracking.errorPropertiesBuilder = new CoreErrorTracking.ErrorPropertiesBuilder(
  [
    new CoreErrorTracking.EventCoercer(),
    new CoreErrorTracking.ErrorCoercer(),
    new CoreErrorTracking.ObjectCoercer(),
    new CoreErrorTracking.StringCoercer(),
    new CoreErrorTracking.PrimitiveCoercer(),
  ],
  CoreErrorTracking.createStackParser('node:javascript', CoreErrorTracking.nodeStackLineParser),
  [createModulerModifier(), addSourceContext]
)

export class Insights extends InsightsBackendClient {
  getLibraryId(): string {
    return 'insights-node'
  }

  protected initializeContext(): InsightsContext {
    return new InsightsContext()
  }
}

export type { InsightsOptions } from '../types'
