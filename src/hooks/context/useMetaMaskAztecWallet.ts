import { useUniversalWallet } from './useUniversalWallet';
import { useEVMWallet } from './useEVMWallet';
import { WalletType } from '../../types/aztec';
import type { MetaMaskAztecConnector } from '../../connectors/MetaMaskAztecConnector';

/**
 * Hook for accessing MetaMask-backed Aztec wallet functionality.
 *
 * This hook provides:
 * - EVM wallet state (from wagmi/useEVMWallet)
 * - Aztec account state (from MetaMaskAztecConnector)
 * - Actions to connect/disconnect
 *
 * Usage:
 * 1. User connects MetaMask via wagmi (useEVMWallet.connectWallet)
 * 2. User clicks "Create Aztec Account" → signs message → Aztec account created
 * 3. Each transaction requires MetaMask signature approval
 */
export const useMetaMaskAztecWallet = () => {
  const universalWallet = useUniversalWallet();
  const evmWallet = useEVMWallet();

  // Get the MetaMask Aztec connector if it's the active one
  const isMetaMaskAztecActive =
    universalWallet.connector?.type === WalletType.METAMASK;
  const connector = isMetaMaskAztecActive
    ? (universalWallet.connector as MetaMaskAztecConnector)
    : null;

  // Get status from connector
  const status = connector?.getStatus();
  const aztecAccount = connector?.getAccount() ?? null;

  return {
    // EVM wallet state (from wagmi)
    evmAddress: evmWallet.address,
    isEVMConnected: evmWallet.isConnected,
    isEVMConnecting: evmWallet.isConnecting,
    connectEVMWallet: evmWallet.connectWallet,
    disconnectEVMWallet: evmWallet.disconnect,

    // Aztec account state
    aztecAccount,
    isAztecConnected: status?.isConnected ?? false,
    isAztecConnecting: status?.isConnecting ?? false,
    isDeploying: connector?.isDeploying() ?? false,

    // Combined state
    isFullyConnected: evmWallet.isConnected && (status?.isConnected ?? false),

    // Actions
    connectAztec: async () => {
      if (connector) {
        await connector.connect();
      }
    },
    disconnect: () => {
      connector?.disconnect();
    },

    // Services
    pxe: connector?.getPXE() ?? null,
    wallet: connector?.getWallet() ?? null,
    getSponsoredFeePaymentMethod: () => {
      if (!connector) {
        return Promise.reject(new Error('MetaMask Aztec connector not active'));
      }
      return connector.getSponsoredFeePaymentMethod();
    },

    // Utilities
    truncateAddress: evmWallet.truncateAddress,

    // Error state
    error: status?.error ?? null,
  };
};
