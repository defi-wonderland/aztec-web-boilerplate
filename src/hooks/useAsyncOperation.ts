import { useState } from 'react';

/**
 * Custom hook for handling async operations with loading and error states
 */
export const useAsyncOperation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeAsync = async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    try {
      setIsLoading(true);
      setError(null);
      return await operation();
    } catch (err) {
      // Handle nested errors and extract the most meaningful message
      let errorMessage: string;
      if (err instanceof Error) {
        // Check if the error message contains nested error information
        if (err.message.includes('Error: ')) {
          // Extract the inner error message
          const match = err.message.match(/Error: (.+)/);
          errorMessage = match ? match[1] : err.message;
        } else {
          errorMessage = err.message;
        }
      } else {
        errorMessage = `Failed to ${operationName}`;
      }

      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, error, executeAsync };
};
