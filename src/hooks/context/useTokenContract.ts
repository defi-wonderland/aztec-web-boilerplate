import { useState, useEffect, useMemo } from 'react';
import { useContractRegistration } from './useContractRegistration';
import { useAztecWallet } from './useAztecWallet';
import { TokenContract } from '../../artifacts/Token';
import type { ContractStatus } from '../../contract-registry';

/**
 * Return type for useTokenContract hook
 */
interface UseTokenContractReturn {
  /** Callable Token contract instance */
  token: TokenContract | null;
  /** Current registration/loading status */
  status: ContractStatus;
  /** Error if registration failed */
  error: Error | null;
  /** Whether the contract is ready to use */
  isReady: boolean;
}

/**
 * Hook for getting a callable Token contract.
 *
 * Handles registration with PXE and returns a ready-to-use contract instance.
 *
 * @example
 * ```typescript
 * function BalanceComponent() {
 *   const { token, isReady } = useTokenContract();
 *   const [balance, setBalance] = useState<bigint>(0n);
 *
 *   useEffect(() => {
 *     if (!token || !isReady) return;
 *
 *     const fetchBalance = async () => {
 *       const result = await token.methods
 *         .balance_of_public(ownerAddress)
 *         .simulate();
 *       setBalance(result);
 *     };
 *
 *     fetchBalance();
 *   }, [token, isReady]);
 *
 *   if (!isReady) return <div>Loading...</div>;
 *
 *   return <div>Balance: {balance.toString()}</div>;
 * }
 * ```
 */
export function useTokenContract(): UseTokenContractReturn {
  const { instance, status, error } = useContractRegistration('token');
  const { wallet } = useAztecWallet();
  const [token, setToken] = useState<TokenContract | null>(null);

  useEffect(() => {
    const createContract = async () => {
      if (!instance || !wallet || status !== 'ready') {
        setToken(null);
        return;
      }

      try {
        const contract = await TokenContract.at(instance.address, wallet);
        setToken(contract);
      } catch (err) {
        console.error('Failed to create Token contract:', err);
        setToken(null);
      }
    };

    createContract();
  }, [instance, wallet, status]);

  const isReady = useMemo(
    () => status === 'ready' && token !== null,
    [status, token]
  );

  return useMemo(
    () => ({
      token,
      status,
      error,
      isReady,
    }),
    [token, status, error, isReady]
  );
}

