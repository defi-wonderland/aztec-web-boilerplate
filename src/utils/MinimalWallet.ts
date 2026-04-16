import {
  type AccountWithSecretKey,
  type Account,
} from '@aztec/aztec.js/account';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AztecNode } from '@aztec/aztec.js/node';
import type { PXE } from '@aztec/pxe/server';
import { BaseWallet } from '@aztec/wallet-sdk/base-wallet';

/**
 * MinimalWallet extends BaseWallet to bootstrap account creation.
 * This bridges PXE to the Wallet interface required by AccountManager.
 *
 * The Aztec SDK requires a Wallet to create an AccountManager, but we need
 * to create accounts before we have a wallet. This minimal implementation
 * provides the necessary interface to bootstrap the account creation process.
 */
export class MinimalWallet extends BaseWallet {
  private readonly addressToAccount = new Map<string, AccountWithSecretKey>();

  constructor(pxe: PXE, aztecNode: AztecNode) {
    super(pxe, aztecNode);
  }

  public addAccount(account: AccountWithSecretKey): void {
    this.addressToAccount.set(account.getAddress().toString(), account);
  }

  protected async getAccountFromAddress(
    address: AztecAddress
  ): Promise<Account> {
    const account = this.addressToAccount.get(address.toString());
    if (!account) {
      throw new Error(
        `Account not found in wallet for address: ${address.toString()}`
      );
    }
    return account;
  }

  async getAccounts(): Promise<{ alias: string; item: AztecAddress }[]> {
    return Array.from(this.addressToAccount.values()).map((acc) => ({
      alias: '',
      item: acc.getAddress(),
    }));
  }
}
