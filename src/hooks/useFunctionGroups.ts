import { useMemo } from 'react';
import {
  formatFunctionSignature,
  type ParsedFunction,
} from '../utils/contractInteraction';

const HIDDEN_FUNCTION_NAMES = ['constructor', 'public_dispatch'];

const hasHiddenAttribute = (attrs: string[] = []): boolean =>
  attrs.includes('initializer') ||
  attrs.includes('abi_initializer') ||
  attrs.includes('abi_only_self');

const isExecutableFn = (fn: ParsedFunction): boolean => {
  const attrs = fn.attributes ?? [];
  const hasAttr = (value: string) => attrs.includes(value);
  const isView = hasAttr('abi_view') || hasAttr('view');
  const isInitializer = hasAttr('abi_initializer') || hasAttr('initializer');
  const isPublic = hasAttr('abi_public') || hasAttr('public');
  const isPrivate = hasAttr('abi_private') || hasAttr('private');
  return (isPublic || isPrivate) && !isView && !isInitializer;
};

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

    const callableFunctions = filteredFunctions.filter(
      (fn) => isExecutableFn(fn) || !fn.isUnconstrained
    );
    const readFunctions = filteredFunctions.filter(
      (fn) => fn.isUnconstrained && !isExecutableFn(fn)
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
