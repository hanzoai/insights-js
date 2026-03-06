declare module '@hanzo/insights-react-native-session-replay' {
  export function start(
    sessionId: string,
    sdkOptions: { [key: string]: any },
    sdkReplayConfig: { [key: string]: any },
    decideReplayConfig: { [key: string]: any }
  ): Promise<void>
  export function startSession(sessionId: string): Promise<void>
  export function endSession(): Promise<void>
  export function isEnabled(): Promise<boolean>
  export function identify(distinctId: string, anonymousId: string): Promise<void>
  export function startRecording(resumeCurrent: boolean): Promise<void>
  export function stopRecording(): Promise<void>

  export interface InsightsReactNativeSessionReplayModule {
    start: (
      sessionId: string,
      sdkOptions: { [key: string]: any },
      sdkReplayConfig: { [key: string]: any },
      decideReplayConfig: { [key: string]: any }
    ) => Promise<void>
    startSession: (sessionId: string) => Promise<void>
    endSession: () => Promise<void>
    isEnabled: () => Promise<boolean>
    identify: (distinctId: string, anonymousId: string) => Promise<void>
    startRecording: (resumeCurrent: boolean) => Promise<void>
    stopRecording: () => Promise<void>
  }

  const InsightsReactNativeSessionReplay: InsightsReactNativeSessionReplayModule
  export default InsightsReactNativeSessionReplay
}
