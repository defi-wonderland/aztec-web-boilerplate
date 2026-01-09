import { createContext } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { WalletType } from '../types/aztec';
import type {
  WalletConnector,
  WalletConnectorId,
} from '../types/walletConnector';

export interface WalletContextType {
  connectors: WalletConnector[];
  connector: WalletConnector | null;
  account: AccountWithSecretKey | null;

  // Derived state
  walletType: WalletType | null;
  isConnected: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  connect: (connectorId: WalletConnectorId) => Promise<WalletConnector>;
  disconnect: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | undefined>(
  undefined
);
