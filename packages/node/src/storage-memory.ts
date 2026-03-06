import { InsightsPersistedProperty } from '@hanzo/insights-core'

export class InsightsMemoryStorage {
  private _memoryStorage: { [key: string]: any | undefined } = {}

  getProperty(key: InsightsPersistedProperty): any | undefined {
    return this._memoryStorage[key]
  }

  setProperty(key: InsightsPersistedProperty, value: any | null): void {
    this._memoryStorage[key] = value !== null ? value : undefined
  }
}
