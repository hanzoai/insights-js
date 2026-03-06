import { generateProductTours } from '../extensions/product-tours'
import { assignableWindow } from '../utils/globals'

assignableWindow.__InsightsExtensions__ = assignableWindow.__InsightsExtensions__ || {}
assignableWindow.__InsightsExtensions__.generateProductTours = generateProductTours

export { findElement, getElementPath, elementIsVisible } from '../extensions/product-tours/element-inference'
export type { InferredSelector, AutoData, SelectorGroup } from '../extensions/product-tours/element-inference'

export default generateProductTours
