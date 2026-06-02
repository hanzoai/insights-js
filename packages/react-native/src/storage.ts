import { isPromise } from '@hanzo/insights-core'
import { InsightsCustomStorage } from './types'

const INSIGHTS_STORAGE_KEY = '.insights-rn.json'
const INSIGHTS_STORAGE_VERSION = 'v1'

type InsightsStorageContents = { [key: string]: any }

export class InsightsRNStorage {
  memoryCache: InsightsStorageContents = {}
  storage: InsightsCustomStorage
  preloadPromise: Promise<void> | undefined
  private _storageKey: string
  private _pendingPromises: Set<Promise<void>> = new Set()
  // Single in-flight debounce timer. Its presence doubles as the "a write is
  // scheduled" flag — one source of truth. Armed on the first mutation in a
  // window and deliberately not reset by later mutations, so write latency is
  // bounded to PERSIST_DEBOUNCE_MS rather than starving under a continuous
  // stream of captures.
  private _persistTimer?: ReturnType<typeof setTimeout>

  constructor(storage: InsightsCustomStorage) {
    this.storage = storage
    this._storageKey = storageKey

    const preloadResult = this.storage.getItem(INSIGHTS_STORAGE_KEY)

    if (isPromise(preloadResult)) {
      this.preloadPromise = preloadResult.then((res) => {
        this.populateMemoryCache(res)
      })

      this.preloadPromise?.finally(() => {
        this.preloadPromise = undefined
      })
    } else {
      this.populateMemoryCache(preloadResult)
    }
  }

  /**
   * Force any scheduled write to be initiated now and await in-flight async
   * writes. Used by durability-sensitive paths (events flush, AppState
   * background, shutdown, login/logout/opt-in/opt-out, fatal exceptions) so the
   * latest state is on its way to the backend before they continue.
   *
   * Best-effort under crash: backend writes are async, so an immediate
   * termination can interrupt them. Never throws — backend errors are logged
   * inside persist() / _drainScheduledPersist().
   */
  async waitForPersist(): Promise<void> {
    this._drainScheduledPersist()
    if (this._pendingPromises.size > 0) {
      await Promise.all(this._pendingPromises)
    }
  }

  persist(): void {
    const payload = {
      version: INSIGHTS_STORAGE_VERSION,
      content: this.memoryCache,
    }

    const result = this.storage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify(payload))

    // Track async persist operations so we can wait for them if needed
    if (isPromise(result)) {
      const promise = result
        .catch((err) => {
          console.warn('Insights storage persist failed:', err)
        })
        .finally(() => {
          this._pendingPromises.delete(promise)
        })
      this._pendingPromises.add(promise)
    }
  }

  // Arm a single debounced persist on the first un-persisted mutation. Repeated
  // calls within the window are no-ops — the mutation is already in memoryCache
  // and the scheduled fire reads the final state.
  private schedulePersist(): void {
    if (this._persistTimer !== undefined) {
      return
    }
    this._persistTimer = safeSetTimeout(() => {
      this._persistTimer = undefined
      try {
        this.persist()
      } catch (err) {
        console.warn('PostHog storage scheduled persist threw:', err)
      }
    }, PERSIST_DEBOUNCE_MS)
  }

  // Force any scheduled persist to fire now (cancels the timer, persists immediately).
  private _drainScheduledPersist(): void {
    if (this._persistTimer === undefined) {
      return
    }
    clearTimeout(this._persistTimer)
    this._persistTimer = undefined
    try {
      this.persist()
    } catch (err) {
      console.warn('PostHog storage drain persist threw:', err)
    }
  }

  getItem(key: string): any | null | undefined {
    return this.memoryCache[key]
  }
  setItem(key: string, value: any): void {
    this.memoryCache[key] = value
    this.schedulePersist()
  }
  removeItem(key: string): void {
    delete this.memoryCache[key]
    this.schedulePersist()
  }
  clear(): void {
    for (const key in this.memoryCache) {
      delete this.memoryCache[key]
    }
    this.schedulePersist()
  }
  getAllKeys(): readonly string[] {
    return Object.keys(this.memoryCache)
  }

  populateMemoryCache(res: string | null): void {
    try {
      const data = res ? JSON.parse(res).content : {}

      for (const key in data) {
        this.memoryCache[key] = data[key]
      }
    } catch (e) {
      console.warn(
        "Insights failed to load persisted data from storage. This is likely because the storage format is. We'll reset the storage.",
        e
      )
    }
  }
}

export class InsightsRNSyncMemoryStorage extends InsightsRNStorage {
  constructor() {
    const cache: { [key: string]: any | undefined } = {}
    const storage = {
      getItem: (key: string) => cache[key],
      setItem: (key: string, value: string) => {
        cache[key] = value
      },
    }

    super(storage, storageKey)
  }
}

// Factory functions that bind the storage instance to the correct SDK-internal
// file. The file names never leave this module — callers (including tests)
// reach storages only through these helpers.
export function createEventsStorage(customStorage: PostHogCustomStorage): PostHogRNStorage {
  return new PostHogRNStorage(customStorage, EVENTS_STORAGE_FILE)
}

export function createLogsStorage(customStorage: PostHogCustomStorage): PostHogRNStorage {
  return new PostHogRNStorage(customStorage, LOGS_STORAGE_FILE)
}

export function createEventsMemoryStorage(): PostHogRNStorage {
  return new PostHogRNSyncMemoryStorage(EVENTS_STORAGE_FILE)
}

export function createLogsMemoryStorage(): PostHogRNStorage {
  return new PostHogRNSyncMemoryStorage(LOGS_STORAGE_FILE)
}
