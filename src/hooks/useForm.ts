import { useCallback, useState } from 'react';

/**
 * Generic hook for managing form/object state with partial updates
 * @param initialState - Initial state object
 * @returns State value, partial update function, reset function, and full setter
 */
export const useForm = <T extends Record<string, unknown>>(initialState: T) => {
  const [state, setState] = useState<T>(initialState);

  /** Update state partially (merges with existing state) */
  const update = useCallback((updates: Partial<T>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /** Reset state to initial values */
  const reset = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  return { state, update, reset, setState };
};

