import React, { useCallback, useEffect, useMemo } from 'react'
import { GestureResponderEvent, StyleProp, View, ViewStyle } from 'react-native'
import { Insights, InsightsOptions } from './insights-rn'
import { autocaptureFromTouchEvent } from './autocapture'
import { useNavigationTracker } from './hooks/useNavigationTracker'
import { InsightsContext } from './InsightsContext'
import { InsightsAutocaptureOptions } from './types'
import { defaultInsightsLabelProp } from './autocapture'

/**
 * Props for the InsightsProvider component.
 *
 * @public
 */
export interface InsightsProviderProps {
  /** The child components to render within the Insights context */
  children: React.ReactNode
  /** Insights configuration options */
  options?: InsightsOptions
  /** Your Insights API key */
  apiKey?: string
  /** An existing Insights client instance */
  client?: Insights
  /** Autocapture configuration - can be a boolean or detailed options */
  autocapture?: boolean | InsightsAutocaptureOptions
  /** Enable debug mode for additional logging */
  debug?: boolean
  /** Custom styles for the provider wrapper View */
  style?: StyleProp<ViewStyle>
}

function InsightsNavigationHook({
  options,
  client,
}: {
  options?: InsightsAutocaptureOptions
  client?: Insights
}): JSX.Element | null {
  useNavigationTracker(options?.navigation, options?.navigationRef, client)
  return null
}

/**
 * InsightsProvider is a React component that provides Insights functionality to your React Native app. You can find all configuration options in the [React Native SDK docs](https://insights.com/docs/libraries/react-native#configuration-options).
 *
 * Autocapturing navigation requires further configuration. See the [React Native SDK navigation docs](https://insights.com/docs/libraries/react-native#capturing-screen-views)
 * for more information about autocapturing navigation.
 *
 * This is the recommended way to set up Insights for React Native. This utilizes the Context API to pass the Insights client around, enable autocapture.
 *
 * {@label Initialization}
 *
 * @example
 * ```jsx
 * // Add to App.(js|ts)
 * import { useInsights, InsightsProvider } from 'insights-react-native'
 *
 * export function MyApp() {
 *     return (
 *         <InsightsProvider apiKey="<ph_project_api_key>" options={{
 *             host: '<ph_client_api_host>',
 *         }}>
 *             <MyComponent />
 *         </InsightsProvider>
 *     )
 * }
 *
 * // And access the Insights client via the useInsights hook
 * import { useInsights } from 'insights-react-native'
 *
 * const MyComponent = () => {
 *     const insights = useInsights()
 *
 *     useEffect(() => {
 *         insights.capture("event_name")
 *     }, [insights])
 * }
 *
 * ```
 *
 * @example
 * ```jsx
 * // Using with existing client
 * import { Insights } from 'insights-react-native'
 *
 * const insights = new Insights('<ph_project_api_key>', {
 *     host: '<ph_client_api_host>'
 * })
 *
 * export function MyApp() {
 *     return (
 *         <InsightsProvider client={insights}>
 *             <MyComponent />
 *         </InsightsProvider>
 *     )
 * }
 * ```
 *
 * @public
 *
 * @param props - The InsightsProvider props
 */
export const InsightsProvider = ({
  children,
  client,
  options,
  apiKey,
  autocapture,
  style,
  debug = false,
}: InsightsProviderProps): JSX.Element | null => {
  if (!client && !apiKey) {
    throw new Error(
      'Either a Insights client or an apiKey is required. If you want to use the InsightsProvider without a client, please provide an apiKey and the options={ disabled: true }.'
    )
  }

  const captureAll = autocapture === true
  const captureNone = autocapture === false

  const insights = useMemo(() => {
    if (client && apiKey) {
      console.warn(
        'You have provided both a client and an apiKey to InsightsProvider. The apiKey will be ignored in favour of the client.'
      )
    }

    if (client) {
      return client
    }

    const parsedOptions = {
      ...options,
      captureAppLifecycleEvents:
        options?.captureAppLifecycleEvents !== undefined
          ? options.captureAppLifecycleEvents
          : !captureNone && captureAll,
    }

    return new Insights(apiKey ?? '', parsedOptions)
  }, [client, apiKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const autocaptureOptions = useMemo(
    () => (autocapture && typeof autocapture !== 'boolean' ? autocapture : {}),
    [autocapture]
  )

  const captureTouches = !captureNone && insights && (captureAll || autocaptureOptions?.captureTouches)
  const captureScreens = !captureNone && insights && (captureAll || (autocaptureOptions?.captureScreens ?? true)) // Default to true if not set
  const phLabelProp = autocaptureOptions?.customLabelProp || defaultInsightsLabelProp

  useEffect(() => {
    insights.debug(debug)
  }, [debug, insights])

  const onTouch = useCallback(
    (type: 'start' | 'move' | 'end', e: GestureResponderEvent) => {
      // TODO: Improve this to ensure we only capture presses and not just ends of a drag for example
      if (!captureTouches) {
        return
      }

      if (type === 'end') {
        autocaptureFromTouchEvent(e, insights, autocaptureOptions)
      }
    },
    [captureTouches, insights, autocaptureOptions]
  )

  return (
    <View
      {...{ [phLabelProp]: 'InsightsProvider' }} // Dynamically setting customLabelProp (default: ph-label)
      style={style || { flex: 1 }}
      onTouchEndCapture={captureTouches ? (e) => onTouch('end', e) : undefined}
    >
      <InsightsContext.Provider value={{ client: insights }}>
        {captureScreens && <InsightsNavigationHook options={autocaptureOptions} client={insights} />}
        {children}
      </InsightsContext.Provider>
    </View>
  )
}
