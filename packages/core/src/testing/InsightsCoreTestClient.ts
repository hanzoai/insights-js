import { InsightsCore } from '@/insights-core'
import type { GetFlagsResult, JsonType, InsightsCoreOptions, InsightsFetchOptions, InsightsFetchResponse } from '@/types'

const version = '2.0.0-alpha'

export interface InsightsCoreTestClientMocks {
  fetch: jest.Mock<Promise<InsightsFetchResponse>, [string, InsightsFetchOptions]>
  storage: {
    getItem: jest.Mock<any | undefined, [string]>
    setItem: jest.Mock<void, [string, any | null]>
  }
}

export class InsightsCoreTestClient extends InsightsCore {
  public _cachedDistinctId?: string

  constructor(
    private mocks: InsightsCoreTestClientMocks,
    apiKey: string,
    options?: InsightsCoreOptions
  ) {
    super(apiKey, options)

    this.setupBootstrap(options)
  }

  // Expose protected methods for testing
  public getFlags(
    distinctId: string,
    groups: Record<string, string | number> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    extraPayload: Record<string, any> = {}
  ): Promise<GetFlagsResult> {
    return super.getFlags(distinctId, groups, personProperties, groupProperties, extraPayload)
  }

  getPersistedProperty<T>(key: string): T {
    return this.mocks.storage.getItem(key)
  }
  setPersistedProperty<T>(key: string, value: T | null): void {
    return this.mocks.storage.setItem(key, value)
  }
  fetch(url: string, options: InsightsFetchOptions): Promise<InsightsFetchResponse> {
    return this.mocks.fetch(url, options)
  }
  getLibraryId(): string {
    return 'insights-core-tests'
  }
  getLibraryVersion(): string {
    return version
  }
  getCustomUserAgent(): string {
    return 'insights-core-tests'
  }
}

export const createTestClient = (
  apiKey: string,
  options?: InsightsCoreOptions,
  setupMocks?: (mocks: InsightsCoreTestClientMocks) => void,
  storageCache: { [key: string]: string | JsonType } = {}
): [InsightsCoreTestClient, InsightsCoreTestClientMocks] => {
  const mocks = {
    fetch: jest.fn(),
    storage: {
      getItem: jest.fn((key) => storageCache[key]),
      setItem: jest.fn((key, val) => {
        storageCache[key] = val == null ? undefined : val
      }),
    },
  }

  mocks.fetch.mockImplementation(() =>
    Promise.resolve({
      status: 200,
      text: () => Promise.resolve('ok'),
      json: () => Promise.resolve({ status: 'ok' }),
    })
  )

  setupMocks?.(mocks)

  return [new InsightsCoreTestClient(mocks, apiKey, { disableCompression: true, ...options }), mocks]
}
