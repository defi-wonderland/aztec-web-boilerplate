/**
 * EVM Wallet Configuration
 *
 * Add new EVM wallets here. Each wallet uses EIP-6963 for discovery.
 * The `rdns` field is the reverse domain name identifier used by EIP-6963.
 *
 * To add a new wallet:
 * 1. Find the wallet's rdns (check their docs or browser console)
 * 2. Add entry below
 * 3. Add evmWallet('id') to walletKit.ts
 */

export interface EVMWalletConfig {
  id: string;
  label: string;
  icon?: string;
  rdns: string;
}

export const EVM_WALLETS = {
  metamask: {
    id: 'metamask',
    label: 'MetaMask',
    icon: '🦊',
    rdns: 'io.metamask',
  },
  rabby: {
    id: 'rabby',
    label: 'Rabby',
    icon: '🐰',
    rdns: 'io.rabby',
  },
  // Add more wallets here as needed:
  // coinbase: {
  //   id: 'coinbase',
  //   label: 'Coinbase Wallet',
  //   icon: '🔵',
  //   rdns: 'com.coinbase.wallet',
  // },
} as const satisfies Record<string, EVMWalletConfig>;

export type EVMWalletId = keyof typeof EVM_WALLETS;

export const getEVMWalletConfig = (id: EVMWalletId): EVMWalletConfig => {
  return EVM_WALLETS[id];
};
