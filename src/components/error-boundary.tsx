'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: (error: Error, reset: () => void) => React.ReactNode
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Algo salió mal</h2>
            <p className="text-sm text-gray-600 mb-4">
              Ocurrió un error inesperado. Puedes intentar recargar la sección.
            </p>
            <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded px-2 py-1 mb-4 break-words">
              {this.state.error.message}
            </p>
            <button
              onClick={this.reset}
              className="px-4 py-2 rounded-lg bg-[#002855] text-white text-sm font-medium hover:bg-[#001d3d]"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
