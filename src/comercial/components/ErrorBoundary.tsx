import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
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
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-background rounded-xl border border-destructive/20 m-4">
          <div className="flex flex-col items-center text-center max-w-md">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Ops! Algo deu errado.</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Ocorreu um erro inesperado ao renderizar esta parte do aplicativo.
            </p>
            <div className="bg-muted p-4 rounded-lg w-full text-left overflow-x-auto text-xs text-muted-foreground font-mono mb-6">
              {this.state.error?.message}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
