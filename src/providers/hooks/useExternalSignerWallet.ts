/**
 * useExternalSignerWallet - Hook for External Signer wallet management
 *
 * Manages wallets that use app-managed PXE with external signing (MetaMask, etc.)
 * This is the generic hook that works with any ExternalSigner implementation.
 */

import { useState, useCallback, useRef } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import type { ExternalSigner } from '../../signers/types';
import { ExternalSignerType } from '../../types/aztec';
import type { ConnectionStatus } from '../../types/walletConnector';
import { EcdsaKEthSignerAccountContract } from '../../accounts/EcdsaKEthSignerAccountContract';
import { useSharedPXE, type UseSharedPXEReturn } from './useSharedPXE';
import { useError } from '../ErrorProvider';
import type { NetworkConfig } from '../../config/networks';
import type { MinimalWallet } from '../../utils/MinimalWallet';

export interface ExternalSignerWalletState {
  aztecAccount: AccountWithSecretKey | null;
  signerType: ExternalSignerType | null;
  status: ConnectionStatus;
  isInitialized: boolean;
}

export interface ExternalSignerWalletActions {
  connect: (signer: ExternalSigner) => Promise<AccountWithSecretKey>;
  disconnect: () => void;
}

export interface ExternalSignerWalletServices {
  pxe: PXE | null;
  wallet: MinimalWallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

export interface UseExternalSignerWalletReturn {
  state: ExternalSignerWalletState;
  actions: ExternalSignerWalletActions;
  services: ExternalSignerWalletServices;
  sharedPXE: UseSharedPXEReturn;
  error: string | null;
}

interface UseExternalSignerWalletOptions {
  config: NetworkConfig;
}

/**
 * Hook for managing External Signer wallets (MetaMask, WalletConnect, etc.)
 *
 * Uses shared PXE with lazy initialization - PXE is only created when connect() is called.
 */
export const useExternalSignerWallet = (
  options: UseExternalSignerWalletOptions
): UseExternalSignerWalletReturn => {
  const { config } = options;

  // Use shared PXE (lazy initialization)
  const sharedPXE = useSharedPXE({ config, autoInitialize: false });

  // Local state
  const [aztecAccount, setAztecAccount] = useState<AccountWithSecretKey | null>(null);
  const [signerType, setSignerType] = useState<ExternalSignerType | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const currentSignerRef = useRef<ExternalSigner | null>(null);
  const { addMessage } = useError();

  const connect = useCallback(
    async (signer: ExternalSigner): Promise<AccountWithSecretKey> => {
      setStatus('connecting');
      setError(null);

      try {
        // Step 1: Connect to external wallet if not already connected
        if (!signer.isConnected()) {
          await signer.connect();
        }

        // Step 2: Initialize shared PXE (lazy)
        const pxeInstance = await sharedPXE.actions.initialize();

        // Step 3: Get public key from signer (requires signature)
        const { x, y } = await signer.getPublicKey();

        // Step 4: Create auth witness provider
        const authWitnessProvider = signer.createAuthWitnessProvider(
          {} as any // CompleteAddress not needed for MetaMask provider
        );

        // Step 5: Create account contract
        const accountContract = new EcdsaKEthSignerAccountContract(
          x,
          y,
          authWitnessProvider
        );

        // Step 6: Derive keys
        const secretKeyBuffer = await signer.deriveSecretKey();
        const secretKey = await poseidon2Hash([Fr.fromBuffer(secretKeyBuffer)]);
        const salt = Fr.fromBuffer(signer.deriveSalt());

        // Step 7: Create AccountManager
        const wallet = pxeInstance.wallet;
        const accountManager = await AccountManager.create(
          wallet,
          secretKey,
          accountContract,
          salt
        );

        const account = await accountManager.getAccount();

        // Register contract with PXE
        const instance = accountManager.getInstance();
        const artifact = await accountManager
          .getAccountContract()
          .getContractArtifact();
        await wallet.registerContract(
          instance,
          artifact,
          accountManager.getSecretKey()
        );

        // Add account to wallet
        wallet.addAccount(account);

        const accountAddress = accountManager.address;
        console.log(
          `✅ External Signer (${signer.type}) Aztec account created:`,
          accountAddress.toString()
        );

        // Step 8: Deploy account if needed
        setStatus('deploying');
        try {
          const metadata = await wallet.getContractMetadata(accountAddress);
          if (!metadata.isContractInitialized) {
            console.log('🚀 Deploying account contract...');
            const deployMethod = await accountManager.getDeployMethod();
            const paymentMethod =
              await pxeInstance.getSponsoredFeePaymentMethod();

            await deployMethod
              .send({
                from: AztecAddress.ZERO,
                fee: { paymentMethod },
                skipClassPublication: true,
                skipInstancePublication: true,
              })
              .wait({ timeout: 120 });
            console.log('✅ Account deployed successfully');
          } else {
            console.log('ℹ️ Account already deployed');
          }
        } catch (deployErr) {
          console.error('❌ Account deployment failed:', deployErr);
          addMessage({
            message: 'Account deployment failed',
            type: 'warning',
            source: 'wallet',
            details:
              deployErr instanceof Error ? deployErr.message : String(deployErr),
          });
        }

        // Update state
        currentSignerRef.current = signer;
        setAztecAccount(account);
        setSignerType(signer.type);
        setStatus('connected');

        return account;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        setError(message);
        setStatus('disconnected');
        console.error('External Signer connection failed:', err);
        
        // Disconnect the signer so next attempt can use a different wallet
        signer.disconnect();
        
        addMessage({
          message: 'Failed to create Aztec account',
          type: 'error',
          source: 'wallet',
          details: message,
        });
        throw err;
      }
    },
    [sharedPXE, addMessage]
  );

  const disconnect = useCallback(() => {
    if (currentSignerRef.current) {
      currentSignerRef.current.disconnect();
      currentSignerRef.current = null;
    }
    setAztecAccount(null);
    setSignerType(null);
    setError(null);
    setStatus('disconnected');
  }, []);

  return {
    state: {
      aztecAccount,
      signerType,
      status,
      isInitialized: sharedPXE.state.isInitialized,
    },
    actions: {
      connect,
      disconnect,
    },
    services: {
      pxe: sharedPXE.services.pxe,
      wallet: sharedPXE.services.wallet,
      getSponsoredFeePaymentMethod: sharedPXE.services.getSponsoredFeePaymentMethod,
    },
    sharedPXE,
    error,
  };
};
