/**
 * Config Factory
 *
 * Resolves any UseAztecConfigInput into a unified UseAztecConfig.
 */

import { buildAppManagedConfig } from './adapters/appManagedAdapter';
import { buildBrowserWalletConfig } from './adapters/browserWalletAdapter';
import { buildConnectorConfig } from './adapters/connectorAdapter';
import type { UseAztecConfigInput, UseAztecConfig } from './types';

/**
 * Creates a resolved UseAztecConfig from one of the supported input shapes.
 *
 * @example
 * ```ts
 * // From aztec-wallet connector
 * const config = createUseAztecConfig({ connector, account, isConnected });
 *
 * // From custom app-managed PXE
 * const config = createUseAztecConfig({ mode: 'app_managed', getWallet, ... });
 *
 * // From custom browser wallet
 * const config = createUseAztecConfig({ mode: 'browser_wallet', executeOperation, ... });
 * ```
 */
export const createUseAztecConfig = (
  input: UseAztecConfigInput
): UseAztecConfig => {
  // Connector-based (no mode field, has connector)
  if ('connector' in input) {
    return buildConnectorConfig(input);
  }

  // Explicit mode-based configs
  if (input.mode === 'app_managed') {
    return buildAppManagedConfig(input);
  }

  if (input.mode === 'browser_wallet') {
    return buildBrowserWalletConfig(input);
  }

  // TypeScript exhaustiveness check
  const _exhaustive: never = input;
  throw new Error(`Unknown config input shape: ${JSON.stringify(_exhaustive)}`);
};
