import { useState, useEffect, useMemo } from 'react';
import { useContractRegistration } from './useContractRegistration';
import { useAztecWallet } from './useAztecWallet';
import { DripperContract } from '../../artifacts/Dripper';
import type { ContractStatus } from '../../contract-registry';

interface UseDripperContractReturn {
  dripper: DripperContract | null;
  status: ContractStatus;
  error: Error | null;
  isReady: boolean;
}

/**
 * Hook for getting a callable Dripper contract.
 *
 * Handles registration with PXE and returns a ready-to-use contract instance.
 *
 * @example
 * ```typescript
 * function DripComponent() {
 *   const { dripper, isReady, status } = useDripperContract();
 *   const { token } = useTokenContract();
 *
 *   const handleDrip = async () => {
 *     if (!dripper || !token) return;
 *
 *     await dripper.methods
 *       .drip_to_public(token.address, 1000n)
 *       .send()
 *       .wait();
 *   };
 *
 *   if (!isReady) return <div>Loading...</div>;
 *
 *   return <button onClick={handleDrip}>Drip Tokens</button>;
 * }
 * ```
 */
export function useDripperContract(): UseDripperContractReturn {
  const { instance, status, error } = useContractRegistration('dripper');
  const { wallet } = useAztecWallet();
  const [dripper, setDripper] = useState<DripperContract | null>(null);

  useEffect(() => {
    const createContract = async () => {
      if (!instance || !wallet || status !== 'ready') {
        setDripper(null);
        return;
      }

      try {
        const contract = await DripperContract.at(instance.address, wallet);
        setDripper(contract);
      } catch (err) {
        console.error('Failed to create Dripper contract:', err);
        setDripper(null);
      }
    };

    createContract();
  }, [instance, wallet, status]);

  const isReady = useMemo(
    () => status === 'ready' && dripper !== null,
    [status, dripper]
  );

  return useMemo(
    () => ({
      dripper,
      status,
      error,
      isReady,
    }),
    [dripper, status, error, isReady]
  );
}

