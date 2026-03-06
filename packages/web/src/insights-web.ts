import { version } from './version'

import { InsightsCore, getFetch } from '@hanzo/insights-core'
import type {
  InsightsEventProperties,
  InsightsFetchOptions,
  InsightsFetchResponse,
  InsightsPersistedProperty,
} from '@hanzo/insights-core'

import { getContext } from './context'
import { InsightsStorage, getStorage } from './storage'
import { InsightsOptions } from './types'
import { patch } from './patch'

export class Insights extends InsightsCore {
  private _storage: InsightsStorage
  private _storageCache: any
  private _storageKey: string
  private _lastPathname: string = ''

  constructor(apiKey: string, options?: InsightsOptions) {
    super(apiKey, options)

    // @hanzo/insights stores options in one object on
    this._storageKey = options?.persistence_name ? `ph_${options.persistence_name}` : `ph_${apiKey}_insights`

    this._storage = getStorage(options?.persistence || 'localStorage', this.getWindow())
    this.setupBootstrap(options)

    if (options?.preloadFeatureFlags !== false) {
      this.reloadFeatureFlags()
    }

    if (options?.captureHistoryEvents && typeof window !== 'undefined') {
      this._lastPathname = window?.location?.pathname || ''
      this.setupHistoryEventTracking()
    }
  }

  private getWindow(): Window | undefined {
    return typeof window !== 'undefined' ? window : undefined
  }

  getPersistedProperty<T>(key: InsightsPersistedProperty): T | undefined {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || '{}') || {}
    }

    return this._storageCache[key]
  }

  setPersistedProperty<T>(key: InsightsPersistedProperty, value: T | null): void {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || '{}') || {}
    }

    if (value === null) {
      delete this._storageCache[key]
    } else {
      this._storageCache[key] = value
    }

    this._storage.setItem(this._storageKey, JSON.stringify(this._storageCache))
  }

  fetch(url: string, options: InsightsFetchOptions): Promise<InsightsFetchResponse> {
    const fetchFn = getFetch()

    if (!fetchFn) {
      // error will be handled by the caller (fetchWithRetry)
      return Promise.reject(new Error('Fetch API is not available in this environment.'))
    }

    return fetchFn(url, options)
  }

  getLibraryId(): string {
    return '@hanzo/insights-lite'
  }

  getLibraryVersion(): string {
    return version
  }

  getCustomUserAgent(): void {
    return
  }

  getCommonEventProperties(): InsightsEventProperties {
    return {
      ...super.getCommonEventProperties(),
      ...getContext(this.getWindow()),
    }
  }

  private setupHistoryEventTracking(): void {
    const window = this.getWindow()
    if (!window) {
      return
    }

    // Old fashioned, we could also use arrow functions but I think the closure for a patch is more reliable
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    patch(window.history, 'pushState', (originalPushState) => {
      return function patchedPushState(this: History, state: any, title: string, url?: string | URL | null): void {
        ;(originalPushState as History['pushState']).call(this, state, title, url)
        self.captureNavigationEvent('pushState')
      }
    })

    patch(window.history, 'replaceState', (originalReplaceState) => {
      return function patchedReplaceState(this: History, state: any, title: string, url?: string | URL | null): void {
        ;(originalReplaceState as History['replaceState']).call(this, state, title, url)
        self.captureNavigationEvent('replaceState')
      }
    })

    // For popstate we need to listen to the event instead of overriding a method
    window.addEventListener('popstate', () => {
      this.captureNavigationEvent('popstate')
    })
  }

  private captureNavigationEvent(navigationType: 'pushState' | 'replaceState' | 'popstate'): void {
    const window = this.getWindow()
    if (!window) {
      return
    }

    const currentPathname = window.location.pathname

    // Only capture pageview if the pathname has changed
    if (currentPathname !== this._lastPathname) {
      this.capture('$pageview', { navigation_type: navigationType })
      this._lastPathname = currentPathname
    }
  }
}
