/**
 * Check if value is an array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

/**
 * Validates that a network configuration has a valid node URL.
 */
export const isValidConfig = (config: { nodeUrl?: string }): boolean => {
  // Check required fields exist
  if (!config.nodeUrl) {
    return false;
  }

  // Validate node URL format
  const urlPattern = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
  if (!urlPattern.test(config.nodeUrl)) {
    return false;
  }

  return true;
};
