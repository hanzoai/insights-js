import { init_as_module } from '../insights-core'

declare module '@hanzo/insights-types' {
    interface TreeShakeableConfig {
        optional: true
    }
}

export { Insights } from '../insights-core'
export * from '../types'
export * from '../insights-surveys-types'
export * from '../insights-product-tours-types'
export * from '../insights-conversations-types'
export type * as BundleTypes from '../extensions/extension-bundles'
export const insights = init_as_module()
export default insights
