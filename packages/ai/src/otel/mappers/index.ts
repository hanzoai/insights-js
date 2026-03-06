import { aiSdkSpanMapper } from './aiSdk'
import type { InsightsSpanMapper } from '../types'

export const defaultSpanMappers: InsightsSpanMapper[] = [aiSdkSpanMapper]
export { aiSdkSpanMapper }
