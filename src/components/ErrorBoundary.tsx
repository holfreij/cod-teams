import { Component, ReactNode } from 'react';
import { Card, Heading, Button } from '@chakra-ui/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
          <Card.Root className="w-full max-w-2xl shadow-xl border border-red-700">
            <Card.Body className="flex flex-col gap-6 p-8">
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <Heading className="text-2xl md:text-3xl font-bold text-red-400 mb-2">
                  Something went wrong
                </Heading>
                <p className="text-gray-300 mb-4">
                  The application encountered an unexpected error.
                </p>
              </div>

              {this.state.error && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <p className="text-sm font-mono text-red-300 break-words">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Button
                  onClick={this.handleReset}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
                >
                  🔄 Reload Application
                </Button>

                <p className="text-xs text-gray-400 text-center">
                  If this problem persists, try clearing your browser cache or contact support.
                </p>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <p className="text-xs text-gray-500 text-center">
                  💡 <strong>Tip:</strong> This app stores data locally and in Supabase.
                  If you're experiencing issues, the app may fall back to local storage automatically.
                </p>
              </div>
            </Card.Body>
          </Card.Root>
        </div>
      );
    }

    return this.props.children;
  }
}
