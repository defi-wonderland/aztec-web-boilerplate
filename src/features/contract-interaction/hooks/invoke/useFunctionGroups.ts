import { useMemo } from 'react';
import {
  formatFunctionSignature,
  hasHiddenAttribute,
  HIDDEN_FUNCTION_NAMES,
  isExecutableFn,
  isReadOnlyFn,
} from '../../utils';
import type { ParsedFunction } from '../../../../types/artifact';

export const useFunctionGroups = (
  functions: ParsedFunction[],
  filter: string
): {
  filteredFunctions: ParsedFunction[];
  grouped: { id: string; label: string; items: ParsedFunction[] }[];
} => {
  const filteredFunctions = useMemo<ParsedFunction[]>(() => {
    if (!functions || functions.length === 0) return [];
    const normalizedFilter = filter.trim().toLowerCase();
    return functions
      .filter(
        (fn) =>
          !HIDDEN_FUNCTION_NAMES.includes(fn.name.toLowerCase()) &&
          !hasHiddenAttribute(fn.attributes ?? [])
      )
      .filter((fn) =>
        formatFunctionSignature(fn).toLowerCase().includes(normalizedFilter)
      );
  }, [filter, functions]);

  const grouped = useMemo(() => {
    if (filteredFunctions.length === 0) return [];

    // Callable: state-changing functions (public/private, not view, not initializer)
    const callableFunctions = filteredFunctions.filter((fn) =>
      isExecutableFn(fn)
    );

    // Read-only: unconstrained, view, or utility functions (can be simulated)
    const readFunctions = filteredFunctions.filter(
      (fn) => isReadOnlyFn(fn) && !isExecutableFn(fn)
    );

    const groups: { id: string; label: string; items: ParsedFunction[] }[] = [];
    if (callableFunctions.length > 0) {
      groups.push({
        id: 'callable',
        label: 'Callable functions',
        items: callableFunctions,
      });
    }
    if (readFunctions.length > 0) {
      groups.push({
        id: 'unconstrained',
        label: 'Unconstrained / read functions',
        items: readFunctions,
      });
    }

    return groups;
  }, [filteredFunctions]);

  return { filteredFunctions, grouped };
};
