import { Component, type ErrorInfo, type ReactNode } from 'react'
import { getStoredRestaurantLanguage } from '../features/restaurant/utils/restaurantLanguage'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

const TEXT = {
  en: {
    heading: 'Something went wrong.',
    body: 'Reload the page and try again.',
    reload: 'Reload page',
  },
  he: {
    heading: 'משהו השתבש.',
    body: 'רעננו את העמוד ונסו שוב.',
    reload: 'רענון העמוד',
  },
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Dev-only diagnostics. Never shown to the user — the fallback UI below
    // never renders the error message or stack trace.
    console.error('Unhandled render error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    const language = getStoredRestaurantLanguage()
    const text = TEXT[language]
    const direction = language === 'he' ? 'rtl' : 'ltr'

    return (
      <div className="error-boundary" dir={direction}>
        <div className="error-boundary-card">
          <h1>{text.heading}</h1>
          <p>{text.body}</p>
          <button type="button" onClick={this.handleReload}>
            {text.reload}
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
