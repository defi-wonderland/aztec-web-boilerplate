import type { ParsedField, ParsedFunction } from '../../types/artifact';

export const HIDDEN_FUNCTION_NAMES = ['constructor', 'public_dispatch'];

export type FunctionCapabilities = {
  isPrivate: boolean;
  isPublic: boolean;
  isView: boolean;
  isUtility: boolean;
  isInitializer: boolean;
  isExecutable: boolean;
  canSimulate: boolean;
};

/**
 * Analyzes function attributes to determine its capabilities and visibility.
 * Handles both prefixed (abi_*) and non-prefixed attribute variants.
 */
export const analyzeFunctionCapabilities = (
  attributes: string[],
  inputs?: ParsedField[],
  isUnconstrained?: boolean
): FunctionCapabilities => {
  const hasAttr = (value: string): boolean => attributes.includes(value);

  const isView = hasAttr('abi_view') || hasAttr('view');
  const isUtility = hasAttr('abi_utility') || hasAttr('utility');
  const isInitializer = hasAttr('abi_initializer') || hasAttr('initializer');
  const attrHasPrivate = hasAttr('abi_private') || hasAttr('private');
  const attrHasPublic = hasAttr('abi_public') || hasAttr('public');

  const anyPrivateInput = Boolean(
    inputs?.some((input) => input.visibility === 'private')
  );
  const isPrivate = attrHasPrivate || (!attrHasPublic && anyPrivateInput);
  const isPublic = attrHasPublic;

  const isExecutable =
    (isPublic || attrHasPrivate) && !isView && !isInitializer;
  const canSimulate = isUnconstrained || isView || isUtility || !isExecutable;

  return {
    isPrivate,
    isPublic,
    isView,
    isUtility,
    isInitializer,
    isExecutable,
    canSimulate,
  };
};

// Function filtering utilities for grouping contract functions

export const hasHiddenAttribute = (attrs: string[] = []): boolean =>
  attrs.includes('initializer') ||
  attrs.includes('abi_initializer') ||
  attrs.includes('abi_only_self');

/**
 * Checks if a function is executable (state-changing).
 * Executable functions are public/private, not view, and not initializers.
 */
export const isExecutableFn = (fn: ParsedFunction): boolean => {
  const capabilities = analyzeFunctionCapabilities(fn.attributes ?? []);
  return capabilities.isExecutable;
};

/**
 * Checks if a function is read-only (can be simulated without transaction).
 * Includes unconstrained functions, view functions, and utility functions.
 */
export const isReadOnlyFn = (fn: ParsedFunction): boolean => {
  const capabilities = analyzeFunctionCapabilities(
    fn.attributes ?? [],
    undefined,
    fn.isUnconstrained
  );
  return capabilities.canSimulate;
};
