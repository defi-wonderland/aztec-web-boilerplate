// Connector types: a unified shape for embedded + external wallets.
// Both paths produce the SAME aztec.js `Wallet`; the difference is
// encapsulated behind `WalletConnector`.
import type { AztecNode } from '@aztec/aztec.js/node';
import type { Wallet, Aliased } from '@aztec/aztec.js/wallet';
import type { AztecAddress } from '@aztec/aztec.js/addresses';

export type ConnectorKind = 'embedded' | 'external';

/**
 * Receives the emoji grid derived from the secure-channel handshake, purely for
 * DISPLAY. Non-blocking: the connector shows the grid and proceeds immediately
 * to confirm() (which triggers the wallet's own permission popup). The grid is
 * the string from `hashToEmoji` (@aztec/wallet-sdk/crypto). Embedded ignores it.
 */
export type OnEmojiGrid = (emojiGrid: string) => void;

export interface ConnectOptions {
  node: AztecNode;
  onEmojiGrid?: OnEmojiGrid;
}

export interface ConnectResult {
  wallet: Wallet;
  /**
   * Accounts the wallet exposed. The store picks one automatically when there's
   * a single account, or asks the user to choose when there are several.
   */
  accounts: Aliased<AztecAddress>[];
}

export interface WalletConnector {
  kind: ConnectorKind;
  label: string;
  connect(opts: ConnectOptions): Promise<ConnectResult>;
  disconnect(): Promise<void>;
}
