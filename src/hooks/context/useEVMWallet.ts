import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';
import { base } from 'wagmi/chains';
import { useCallback } from 'react';
import type { Address } from 'viem';

export const useEVMWallet = () => {
  const { address, isConnected, isConnecting, connector } = useAccount();
  const { connect, connectAsync, connectors, error: connectError, isPending } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const chainId = useChainId();

  const connectWallet = useCallback(() => {
    const injectedConnector = connectors.find((c) => c.id === 'injected');
    if (injectedConnector) {
      connect({ connector: injectedConnector, chainId: base.id });
    }
  }, [connect, connectors]);

  const connectWalletAsync = useCallback(async (): Promise<Address | undefined> => {
    const injectedConnector = connectors.find((c) => c.id === 'injected');
    if (injectedConnector) {
      const result = await connectAsync({ connector: injectedConnector, chainId: base.id });
      return result.accounts[0];
    }
    return undefined;
  }, [connectAsync, connectors]);

  const truncateAddress = useCallback((addr: string | undefined): string => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, []);

  const isWrongChain = isConnected && chainId !== base.id;

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isPending,
    isDisconnecting,
    connector,
    connectError,
    isWrongChain,
    connectWallet,
    connectWalletAsync,
    disconnect,
    truncateAddress,
  };
};
