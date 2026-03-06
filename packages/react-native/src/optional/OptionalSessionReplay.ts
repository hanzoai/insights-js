import { Platform } from 'react-native'

import type InsightsReactNativeSessionReplay from '@hanzo/insights-react-native-session-replay'

/**
 * Extended type for the session replay plugin.
 *
 * Methods marked as optional may not exist in older plugin versions.
 * The SDK checks for their availability at runtime before calling them.
 */
export type InsightsReactNativeSessionReplayExtended = typeof InsightsReactNativeSessionReplay & {
  startRecording?: (resumeCurrent: boolean) => Promise<void>
  stopRecording?: () => Promise<void>
}

export let OptionalReactNativeSessionReplay: InsightsReactNativeSessionReplayExtended | undefined = undefined

try {
  OptionalReactNativeSessionReplay = Platform.select({
    macos: undefined,
    web: undefined,
    default: require('@hanzo/insights-react-native-session-replay'), // Only Android and iOS
  })
} catch (e) {}
