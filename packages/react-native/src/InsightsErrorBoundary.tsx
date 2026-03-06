import React, { FunctionComponent } from 'react'
import { InsightsContext } from './InsightsContext'

export type Properties = Record<string, any>

export type InsightsErrorBoundaryFallbackProps = {
  error: unknown
  componentStack: string
}

export type InsightsErrorBoundaryProps = {
  children?: React.ReactNode | (() => React.ReactNode)
  fallback?: React.ReactNode | FunctionComponent<InsightsErrorBoundaryFallbackProps>
  additionalProperties?: Properties | ((error: unknown) => Properties)
}

type InsightsErrorBoundaryState = {
  componentStack: string | null
  error: unknown
}

const INITIAL_STATE: InsightsErrorBoundaryState = {
  componentStack: null,
  error: null,
}

const isFunction = (f: any): f is (...args: any[]) => any => typeof f === 'function'

export class InsightsErrorBoundary extends React.Component<InsightsErrorBoundaryProps, InsightsErrorBoundaryState> {
  static contextType = InsightsContext
  context!: React.ContextType<typeof InsightsContext>

  constructor(props: InsightsErrorBoundaryProps) {
    super(props)
    this.state = INITIAL_STATE
  }

  static getDerivedStateFromError(error: unknown): Partial<InsightsErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    const { additionalProperties } = this.props
    let currentProperties
    if (isFunction(additionalProperties)) {
      currentProperties = additionalProperties(error)
    } else if (typeof additionalProperties === 'object') {
      currentProperties = additionalProperties
    }
    const { client } = this.context
    client?.captureException(error, currentProperties)

    const { componentStack } = errorInfo
    this.setState({
      error,
      componentStack: componentStack ?? null,
    })
  }

  public render(): React.ReactNode {
    const { children, fallback } = this.props
    const state = this.state

    if (state.error == null) {
      return isFunction(children) ? children() : children
    }

    const element = isFunction(fallback)
      ? (React.createElement(fallback, {
          error: state.error,
          componentStack: state.componentStack ?? '',
        }) as React.ReactNode)
      : fallback

    if (React.isValidElement(element)) {
      return element as React.ReactElement
    }

    return <></>
  }
}
