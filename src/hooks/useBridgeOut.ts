import { useState } from 'react';
import { parseUnits } from 'viem';
import { Fr } from '@aztec/aztec.js';
import { useAztecWallet } from './context/useAztecWallet';
import { useEVMWallet } from './context/useEVMWallet';
import { useError } from '../providers/ErrorProvider';
import { type OrderStatus } from '../types';

interface UseBridgeOutParams {
  onSuccess?: () => void;
}

export const useBridgeOut = ({ onSuccess }: UseBridgeOutParams = {}) => {
  const { connectedAccount: aztecWallet, bridgeService } = useAztecWallet();
  const { account: evmAccount } = useEVMWallet();
  const { addMessage } = useError();
  
  const [isBridging, setIsBridging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);

  const bridgeOut = async (amount: string, privateBalance: bigint) => {
    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return { success: false };
    }

    const amountWei = parseUnits(amount, 18);
    if (amountWei > privateBalance) {
      setError('Insufficient private balance');
      return { success: false };
    }

    if (!evmAccount?.address) {
      setError('Please connect your EVM wallet first');
      return { success: false };
    }

    if (!aztecWallet) {
      setError('Please connect your Aztec wallet first');
      return { success: false };
    }

    if (!bridgeService) {
      setError('Bridge service not available');
      return { success: false };
    }

    setIsBridging(true);
    setError(null);
    setOrderStatus(null);

    try {
      // Generate a random nonce for the order
      const nonce = Fr.random();
      
      console.log('Initiating bridge:', {
        amount: amount,
        amountWei: amountWei.toString(),
        from: aztecWallet.getAddress().toString(),
        to: evmAccount.address,
      });

      // Call bridge service to open order
      const result = await bridgeService.openAztecToEvmOrder({
        confidential: true, // Always use private balance
        sourceAmount: amountWei,
        targetAmount: amountWei, // 1:1 for WETH bridge
        recipientAddress: evmAccount.address,
        nonce,
        callbacks: {
          onOrderOpened: (orderId: string, txHash: string) => {
            console.log('Order opened:', { orderId, txHash });
            addMessage({
              message: `Bridge order opened: ${orderId.slice(0, 10)}...`,
              type: 'info',
              source: 'bridge',
            });
          },
          onOrderFilled: (orderId: string, fillTxHash: string) => {
            console.log('Order filled:', { orderId, fillTxHash });
            addMessage({
              message: `Bridge completed! Tokens sent to Base Sepolia`,
              type: 'success',
              source: 'bridge',
            });
          },
          onStatusUpdate: (status: OrderStatus) => {
            setOrderStatus(status);
          },
          onError: (error: Error) => {
            console.error('Bridge error:', error);
            setError(error.message);
          },
        },
      });

      if (result.status === 'filled') {
        addMessage({
          message: `Successfully bridged ${amount} WETH to Base Sepolia`,
          type: 'success',
          source: 'bridge',
        });
        onSuccess?.();
        return { success: true };
      } else if (result.status === 'failed') {
        throw new Error(result.error || 'Bridge transaction failed');
      }
      
      return { success: true };
    } catch (err) {
      console.error('Bridge error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Bridge transaction failed';
      setError(errorMessage);
      addMessage({
        message: errorMessage,
        type: 'error',
        source: 'bridge',
      });
      return { success: false };
    } finally {
      setIsBridging(false);
    }
  };

  const clearError = () => setError(null);

  return {
    bridgeOut,
    isBridging,
    error,
    orderStatus,
    clearError,
  };
};