import { useState, useEffect, useCallback, useMemo } from 'react';
import { AztecAddress } from '@aztec/aztec.js';
import { useAztecWallet } from './context';
import { AztecStorageService } from '../services/aztec/storage';
import { SUCCESS_MESSAGE_TIMEOUT } from '../config/bridgeConstants';

export const useRegisterSender = () => {
  const [registeredSenders, setRegisteredSenders] = useState<string[]>([]);
  const [newSenderAddress, setNewSenderAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { walletService } = useAztecWallet();
  const storageService = useMemo(() => new AztecStorageService(), []);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const setSuccessMessage = useCallback((message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), SUCCESS_MESSAGE_TIMEOUT);
  }, []);

  const loadRegisteredSenders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const savedSenders = storageService.getSenders();
      setRegisteredSenders(savedSenders);
      
      if (walletService?.getPXE) {
        const pxe = walletService.getPXE();
        const pxeSenders = await pxe.getSenders();
        const pxeSenderStrings = pxeSenders.map(addr => addr.toString());
        
        setRegisteredSenders(pxeSenderStrings);
        storageService.saveSenders(pxeSenderStrings);
      }
    } catch (err) {
      setError(`Failed to load registered senders: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [walletService, storageService]);

  const handleAddSender = useCallback(async () => {
    const trimmedAddress = newSenderAddress.trim();
    if (!trimmedAddress) {
      setError('Please enter a valid address');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const aztecAddress = AztecAddress.fromString(trimmedAddress);
      const addressString = aztecAddress.toString();

      if (registeredSenders.includes(addressString)) {
        setError('This address is already registered');
        return;
      }

      if (walletService?.getPXE) {
        const pxe = walletService.getPXE();
        await pxe.registerSender(aztecAddress);
      }

      storageService.addSender(addressString);
      
      setRegisteredSenders(prev => [...prev, addressString]);
      setNewSenderAddress('');
      setSuccessMessage('Sender registered successfully');

    } catch (err) {
      setError(`Failed to register sender: ${err instanceof Error ? err.message : 'Invalid address format'}`);
    } finally {
      setIsLoading(false);
    }
  }, [newSenderAddress, registeredSenders, walletService, storageService, setSuccessMessage]);

  const handleRemoveSender = useCallback(async (senderAddress: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      if (walletService?.getPXE) {
        const pxe = walletService.getPXE();
        const aztecAddress = AztecAddress.fromString(senderAddress);
        await pxe.removeSender(aztecAddress);
      }

      storageService.removeSender(senderAddress);
      
      setRegisteredSenders(prev => prev.filter(addr => addr !== senderAddress));
      setSuccessMessage('Sender removed successfully');

    } catch (err) {
      setError(`Failed to remove sender: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [walletService, storageService, setSuccessMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSender();
    }
  }, [handleAddSender]);

  useEffect(() => {
    loadRegisteredSenders();
  }, [loadRegisteredSenders]);

  return {
    registeredSenders,
    newSenderAddress,
    setNewSenderAddress,
    isLoading,
    error,
    success,
    handleAddSender,
    handleRemoveSender,
    handleKeyPress,
    clearMessages,
    setSuccessMessage,
    loadRegisteredSenders,
  };
};