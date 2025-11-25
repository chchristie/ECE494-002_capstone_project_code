import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { theme } from '../styles/theme';

// Type definitions with strict typing
interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

// Type guard for error validation
const isValidError = (error: unknown): error is Error => {
  return error instanceof Error && typeof error.message === 'string';
};

// Error severity classification
type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

const classifyError = (error: Error): ErrorSeverity => {
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';

  if (message.includes('network') || message.includes('fetch')) {
    return 'medium';
  }
  if (message.includes('bluetooth') || message.includes('device')) {
    return 'high';
  }
  if (stack.includes('navigation') || message.includes('navigation')) {
    return 'medium';
  }
  if (message.includes('permission') || message.includes('denied')) {
    return 'high';
  }
  
  return 'low'; // Default for unknown errors
};

// Generate unique error ID for tracking
const generateErrorId = (): string => {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
};

// Memoized error display component
const ErrorDisplay = React.memo<{
  error: Error;
  errorInfo: ErrorInfo;
  errorId: string;
  onRetry: () => void;
  onDismiss: () => void;
}>(({ error, errorInfo, errorId, onRetry, onDismiss }) => {
  const severity = classifyError(error);
  const errorColor = {
    low: theme.colors.tertiary,
    medium: theme.colors.secondary,
    high: theme.colors.error,
    critical: '#D32F2F',
  }[severity];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.errorContainer}>
        <View style={[styles.errorHeader, { backgroundColor: `${errorColor}15` }]}>
          <Icon 
            name="error-outline" 
            size={32} 
            color={errorColor}
            style={styles.errorIcon}
          />
          <Text style={[styles.errorTitle, { color: errorColor }]}>
            Something went wrong
          </Text>
        </View>

        <View style={styles.errorContent}>
          <Text style={styles.errorMessage}>{error.message}</Text>
          
          <View style={styles.errorDetails}>
            <Text style={styles.errorDetailLabel}>Error ID:</Text>
            <Text style={styles.errorDetailValue}>{errorId}</Text>
          </View>
          
          <View style={styles.errorDetails}>
            <Text style={styles.errorDetailLabel}>Severity:</Text>
            <Text style={[
              styles.errorDetailValue, 
              styles.severityBadge,
              { 
                backgroundColor: `${errorColor}20`,
                color: errorColor,
              }
            ]}>
              {severity.toUpperCase()}
            </Text>
          </View>

          {__DEV__ && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugLabel}>Debug Information:</Text>
              <View style={styles.debugContent}>
                <Text style={styles.debugText}>Component Stack:</Text>
                <Text style={styles.debugStackTrace}>
                  {errorInfo.componentStack}
                </Text>
                {error.stack && (
                  <>
                    <Text style={styles.debugText}>Error Stack:</Text>
                    <Text style={styles.debugStackTrace}>
                      {error.stack}
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Icon name="refresh" size={20} color={theme.colors.onPrimary} />
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Icon name="close" size={20} color={theme.colors.onSurface} />
            <Text style={styles.secondaryButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
});

ErrorDisplay.displayName = 'ErrorDisplay';

/**
 * Error Boundary component with comprehensive error handling
 * Implements user preferences for error boundaries and retry logic
 */
class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    if (isValidError(error)) {
      return {
        hasError: true,
        error,
        errorId: generateErrorId(),
      };
    }
    
    // If error is not valid, create a generic error
    return {
      hasError: true,
      error: new Error('An unknown error occurred'),
      errorId: generateErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging and analytics
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // Auto-retry for certain error types after delay
    const severity = classifyError(error);
    if (severity === 'low' || severity === 'medium') {
      this.scheduleAutoRetry();
    }
  }

  componentDidUpdate(prevProps: Props): void {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error boundary if reset keys change
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      
      if (hasResetKeyChanged) {
        this.resetError();
      }
    }

    // Reset on any prop change if enabled
    if (hasError && resetOnPropsChange && prevProps !== this.props) {
      this.resetError();
    }
  }

  componentWillUnmount(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private scheduleAutoRetry = (): void => {
    // Clear any existing timeout
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    // Schedule auto-retry after 5 seconds for recoverable errors
    this.resetTimeoutId = setTimeout(() => {
      console.log('Auto-retrying after error...');
      this.resetError();
    }, 5000);
  };

  private resetError = (): void => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  private handleRetry = (): void => {
    console.log('Manual retry requested');
    this.resetError();
  };

  private handleDismiss = (): void => {
    // For now, just reset the error
    // In a real app, you might navigate to a safe screen
    console.log('Error dismissed by user');
    this.resetError();
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback && errorInfo) {
        try {
          return fallback(error, errorInfo);
        } catch (fallbackError) {
          console.error('Error in fallback component:', fallbackError);
          // Fall through to default error display
        }
      }

      // Default error display
      return (
        <ErrorDisplay
          error={error}
          errorInfo={errorInfo || { componentStack: 'Unknown' }}
          errorId={errorId}
          onRetry={this.handleRetry}
          onDismiss={this.handleDismiss}
        />
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  errorContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorIcon: {
    marginRight: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  errorContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  errorMessage: {
    fontSize: 16,
    color: theme.colors.onSurface,
    marginBottom: 16,
    lineHeight: 22,
  },
  errorDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorDetailLabel: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '500',
    marginRight: 8,
  },
  errorDetailValue: {
    fontSize: 14,
    color: theme.colors.onSurface,
    fontFamily: 'monospace',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: `${theme.colors.outline}10`,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.tertiary,
  },
  debugLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  debugContent: {
    gap: 8,
  },
  debugText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.onSurfaceVariant,
    marginTop: 8,
  },
  debugStackTrace: {
    fontSize: 11,
    color: theme.colors.onSurfaceVariant,
    fontFamily: 'monospace',
    lineHeight: 16,
    backgroundColor: `${theme.colors.outline}20`,
    padding: 8,
    borderRadius: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    elevation: 2,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.onSurface,
  },
});

export default ErrorBoundary;