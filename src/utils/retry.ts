// src/utils/retry.ts
export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
  shouldRetry?: (error: Error) => boolean;
}

export class RetryManager {
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const { maxAttempts, delay, backoff = 'linear', shouldRetry } = options;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (shouldRetry && !shouldRetry(lastError)) {
          throw lastError;
        }

        if (attempt === maxAttempts) {
          throw lastError;
        }

        const waitTime = backoff === 'exponential' 
          ? delay * Math.pow(2, attempt - 1)
          : delay * attempt;

        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError!;
  }
}