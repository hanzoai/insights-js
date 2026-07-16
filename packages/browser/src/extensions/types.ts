import type { Insights } from '../insights-core'
import type { RemoteConfig } from '../types'

export type ExtensionConstructor<T extends Extension> = new (instance: Insights, ...args: any[]) => T

export interface Extension {
    initialize?(): boolean | void
    onRemoteConfig?(config: RemoteConfig): void
}
