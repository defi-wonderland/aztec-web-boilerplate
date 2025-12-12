/**
 * Internal hook for MetaMask-backed Aztec wallet management.
 * Uses MetaMask as an external signer - no private keys stored in browser.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, useSignMessage, useConfig, useChainId } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import { type Hex, keccak256, toBytes } from 'viem';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { EcdsaKEthSignerAccountContract } from '../../accounts/EcdsaKEthSignerAccountContract';
import { MetaMaskAuthWitnessProvider } from '../../accounts/MetaMaskAuthWitnessProvider';
import {
  recoverPublicKeyFromSignature,
  getPublicKeyRecoveryMessage,
} from '../../utils/evmPublicKeyRecovery';
import {
  initializeWalletServices,
  type WalletServices,
} from '../../services/aztec/wallet';
import { useError } from '../ErrorProvider';
import type { NetworkConfig } from '../../config/networks';

export interface MetaMaskAztecWalletState {
  aztecAccount: AccountWithSecretKey | null;
  evmAddress: Hex | null;
  isEVMConnected: boolean;
  isConnecting: boolean;
  isDeploying: boolean;
  isInitialized: boolean;
}

export interface MetaMaskAztecWalletActions {
  connectAztec: () => Promise<void>;
  disconnect: () => void;
}

export interface MetaMaskAztecWalletServices {
  pxe: PXE | null;
  wallet: Wallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

export interface UseMetaMaskAztecWalletInternalReturn {
  state: MetaMaskAztecWalletState;
  actions: MetaMaskAztecWalletActions;
  services: MetaMaskAztecWalletServices;
  error: string | null;
}

interface UseMetaMaskAztecWalletInternalOptions {
  config: NetworkConfig;
}

export const useMetaMaskAztecWalletInternal = (
  options: UseMetaMaskAztecWalletInternalOptions
): UseMetaMaskAztecWalletInternalReturn => {
  const { config } = options;

  // Wagmi hooks for MetaMask
  const wagmiConfig = useConfig();
  const chainId = useChainId();
  const { address: evmAddress, isConnected: isEVMConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();

  // Local state
  const [aztecAccount, setAztecAccount] = useState<AccountWithSecretKey | null>(
    null
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletServicesRef = useRef<WalletServices | null>(null);
  const publicKeyRef = useRef<{ x: Buffer; y: Buffer } | null>(null);

  const { addMessage } = useError();

  // Initialize wallet services
  useEffect(() => {
    const init = async () => {
      if (!walletServicesRef.current) {
        try {
          const services = await initializeWalletServices(config.nodeUrl);
          walletServicesRef.current = services;
          setIsInitialized(true);
        } catch (err) {
          console.error('Failed to initialize wallet services:', err);
          setError(
            err instanceof Error ? err.message : 'Failed to initialize'
          );
        }
      }
    };
    init();
  }, [config.nodeUrl]);

  const connectAztec = useCallback(async () => {
    if (!walletServicesRef.current) {
      setError('Wallet services not initialized');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Fetch the current wallet client directly (handles timing issues after connect)
      const currentWalletClient = await getWalletClient(wagmiConfig);
      if (!currentWalletClient) {
        setError('Please connect MetaMask first');
        setIsConnecting(false);
        return;
      }

      const currentAddress = currentWalletClient.account.address;

      // Step 1: Sign a message to recover the public key
      const message = getPublicKeyRecoveryMessage(currentAddress);
      const signature = await signMessageAsync({ message });

      // Step 2: Recover public key from signature
      const { x, y } = await recoverPublicKeyFromSignature(message, signature);
      publicKeyRef.current = { x, y };

      // Step 3: Create the auth witness provider (will call MetaMask for each tx)
      // Pass chainId for EIP-712 domain; accountAddress will be set after AccountManager creation
      const authWitnessProvider = new MetaMaskAuthWitnessProvider(
        currentWalletClient,
        currentAddress,
        chainId
      );

      // Step 4: Create the account contract
      const accountContract = new EcdsaKEthSignerAccountContract(
        x,
        y,
        authWitnessProvider
      );

      // Step 5: Derive secretKey from the same signature (reuse for both public key recovery and privacy key derivation)
      // This ensures only the key holder can derive their privacy keys while requiring just one signature
      const signatureHash = keccak256(toBytes(signature));
      const secretKey = await poseidon2Hash([Fr.fromBuffer(Buffer.from(signatureHash.slice(2), 'hex'))]);

      // Salt can still be derived from address (it's not secret, just needs to be deterministic)
      const addressBytes = Buffer.from(currentAddress.slice(2).padStart(64, '0'), 'hex');
      const salt = Fr.fromBuffer(addressBytes.slice(0, 32));

      // Step 6: Create AccountManager and get wallet
      const services = walletServicesRef.current;
      const minimalWallet = services.walletService.getWallet();

      const accountManager = await AccountManager.create(
        minimalWallet,
        secretKey,
        accountContract,
        salt
      );

      const wallet = await accountManager.getAccount();

      // Register the contract with PXE
      const instance = accountManager.getInstance();
      const artifact = await accountManager
        .getAccountContract()
        .getContractArtifact();
      await minimalWallet.registerContract(
        instance,
        artifact,
        accountManager.getSecretKey()
      );

      // Add the account to minimalWallet and set as current (required for deployment)
      minimalWallet.addAccount(wallet);

      const accountAddress = accountManager.address;

      // Update the auth witness provider with the actual account address for EIP-712 domain
      authWitnessProvider.setAccountAddress(`0x${accountAddress.toString().slice(2)}` as Hex);

      console.log('✅ MetaMask Aztec account created:', accountAddress.toString());

      // Deploy the account
      setIsDeploying(true);
      try {
        const metadata = await minimalWallet.getContractMetadata(accountAddress);
        if (!metadata.isContractInitialized) {
          console.log('🚀 Deploying account contract...');
          const deployMethod = await accountManager.getDeployMethod();
          const paymentMethod =
            await services.walletService.getSponsoredFeePaymentMethod();

          // On testnets (devnet), we need to register the contract class if not already done.
          // On sandbox, classes are auto-registered locally so we can skip.
          // First deployment on a testnet will register the class; subsequent ones will skip.
          const skipClassRegistration = !config.isTestnet;
          if (!skipClassRegistration) {
            console.log('📝 Testnet detected, will attempt class registration...');
          }

          // Use AztecAddress.ZERO as sender - this triggers SignerlessAccount in MinimalWallet,
          // allowing deployment without requiring the (not-yet-existing) account to authorize itself.
          // skipTxValidation: true - skip simulation that fails trying to read non-existent note
          await deployMethod
            .send({
              contractAddressSalt: salt,
              fee: { paymentMethod },
              skipClassRegistration,
              skipClassPublication: skipClassRegistration,
              skipPublicDeployment: true,
              universalDeploy: true,
              skipTxValidation: true,
              from: AztecAddress.ZERO,
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
      } finally {
        setIsDeploying(false);
      }

      setAztecAccount(wallet);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      console.error('MetaMask Aztec connection failed:', err);
      addMessage({
        message: 'Failed to create Aztec account',
        type: 'error',
        source: 'wallet',
        details: message,
      });
    } finally {
      setIsConnecting(false);
    }
  }, [wagmiConfig, chainId, signMessageAsync, addMessage]);

  const disconnect = useCallback(() => {
    setAztecAccount(null);
    publicKeyRef.current = null;
    setError(null);
    setIsDeploying(false);
  }, []);

  // Reset Aztec account when EVM wallet disconnects
  useEffect(() => {
    if (!isEVMConnected && aztecAccount) {
      disconnect();
    }
  }, [isEVMConnected, aztecAccount, disconnect]);

  return {
    state: {
      aztecAccount,
      evmAddress: evmAddress ?? null,
      isEVMConnected,
      isConnecting,
      isDeploying,
      isInitialized,
    },
    actions: {
      connectAztec,
      disconnect,
    },
    services: {
      pxe: walletServicesRef.current?.walletService.getPXE() ?? null,
      wallet: walletServicesRef.current?.walletService.getWallet() ?? null,
      getSponsoredFeePaymentMethod: () => {
        if (!walletServicesRef.current) {
          return Promise.reject(new Error('Wallet services not initialized'));
        }
        return walletServicesRef.current.walletService.getSponsoredFeePaymentMethod();
      },
    },
    error,
  };
};
