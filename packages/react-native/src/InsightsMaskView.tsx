import React from 'react'
import { View, ViewProps } from 'react-native'

/**
 * Props for the InsightsMaskView component.
 *
 * @public
 */
export interface InsightsMaskViewProps extends ViewProps {
  /** The child components to mask from Insights capture */
  children: React.ReactNode
}

/**
 * InsightsMaskView is a wrapper component that hides its children from Insights
 * session recordings without compromising accessibility.
 *
 * It works by:
 * - Setting `accessibilityLabel` to `"ph-no-capture"` to hide the content from session recordings
 * - Setting `importantForAccessibility` to `"no"` to prevent the wrapper View from hiding
 *   accessible content on Android (since `accessibilityLabel` would otherwise interfere)
 *
 * @example
 * ```jsx
 * import { InsightsMaskView } from 'insights-react-native'
 *
 * function SensitiveForm() {
 *   return (
 *     <InsightsMaskView>
 *       <TextInput placeholder="Credit card number" />
 *       <TextInput placeholder="CVV" />
 *     </InsightsMaskView>
 *   )
 * }
 * ```
 *
 * @public
 */
export const InsightsMaskView = ({ children, ...viewProps }: InsightsMaskViewProps): JSX.Element => (
  <View {...viewProps} accessibilityLabel="ph-no-capture" importantForAccessibility="no">
    {children}
  </View>
)
