export * from '../exports'

import { createModulerModifier } from '../extensions/error-tracking/modifiers/module.node'
import { addSourceContext } from '../extensions/error-tracking/modifiers/context-lines.node'
import { createRelativePathModifier } from '../extensions/error-tracking/modifiers/relative-path.node'

import { InsightsBackendClient } from '../client'
import { ErrorTracking as CoreErrorTracking } from '@hanzo/insights-core'
import { InsightsContext } from '../extensions/context/context'

export class Insights extends InsightsBackendClient {
  getLibraryId(): string {
    return 'insights-node'
  }

  protected initializeContext(): InsightsContext {
    return new InsightsContext()
  }

  protected override createErrorPropertiesBuilder(): CoreErrorTracking.ErrorPropertiesBuilder {
    return new CoreErrorTracking.ErrorPropertiesBuilder(
      [
        new CoreErrorTracking.EventCoercer(),
        new CoreErrorTracking.ErrorCoercer(),
        new CoreErrorTracking.ObjectCoercer(),
        new CoreErrorTracking.StringCoercer(),
        new CoreErrorTracking.PrimitiveCoercer(),
      ],
      CoreErrorTracking.createStackParser('node:javascript', CoreErrorTracking.nodeStackLineParser),
      [createModulerModifier(), addSourceContext, createRelativePathModifier()]
    )
  }
}

export type { InsightsOptions } from '../types'
