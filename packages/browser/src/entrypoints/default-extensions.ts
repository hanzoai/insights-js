import { Insights } from '../insights-core'
import { AllExtensions } from '../extensions/extension-bundles'

Insights.__defaultExtensionClasses = {
    ...AllExtensions,
}
