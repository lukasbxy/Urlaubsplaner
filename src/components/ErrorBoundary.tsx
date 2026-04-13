import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'Ein unerwarteter Fehler ist aufgetreten.';
      let isQuotaError = false;

      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error && parsed.error.includes('Quota exceeded')) {
          isQuotaError = true;
          errorMessage = 'Das tägliche Limit für Datenbank-Abfragen wurde erreicht. Bitte versuche es morgen wieder oder kontaktiere den Support.';
        } else if (parsed.error) {
          errorMessage = parsed.error;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="p-6 max-w-md mx-auto mt-10 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
          <h2 className="text-lg font-bold mb-2">{isQuotaError ? 'Limit erreicht' : 'Hoppla! Etwas ist schiefgelaufen'}</h2>
          <p className="text-sm mb-4">{isQuotaError ? errorMessage : 'Ein Fehler ist beim Laden dieser Komponente aufgetreten.'}</p>
          {!isQuotaError && (
            <pre className="text-xs bg-destructive/5 p-2 rounded overflow-auto max-h-40 mb-4">
              {errorMessage}
            </pre>
          )}
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 transition-opacity"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            {isQuotaError ? 'Seite neu laden' : 'Erneut versuchen'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
