import {
  type AccountWithSecretKey,
  type Account,
  SignerlessAccount,
} from '@aztec/aztec.js/account';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AztecNode } from '@aztec/aztec.js/node';
import type { PXE } from '@aztec/pxe/server';
import { BaseWallet } from '@aztec/wallet-sdk/base-wallet';

export class MinimalWallet extends BaseWallet {
  private readonly addressToAccount = new Map<string, AccountWithSecretKey>();

  constructor(pxe: PXE, aztecNode: AztecNode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(pxe as unknown as any, aztecNode);
  }

  /**
   * Add an account to this wallet's internal registry
   */
  public addAccount(account: AccountWithSecretKey): void {
    this.addressToAccount.set(account.getAddress().toString(), account);
  }

  /**
   * Get an account by its address
   */
  protected async getAccountFromAddress(
    address: AztecAddress
  ): Promise<Account> {
    let account: Account | undefined;

    if (address.equals(AztecAddress.ZERO)) {
      const chainInfo = await this.getChainInfo();
      account = new SignerlessAccount(chainInfo);
    } else {
      account = this.addressToAccount.get(address.toString());
    }

    if (!account) {
      throw new Error(
        `Account not found in wallet for address: ${address.toString()}`
      );
    }

    return account;
  }

  /**
   * Get all accounts registered with this wallet
   */
  async getAccounts(): Promise<{ alias: string; item: AztecAddress }[]> {
    return Array.from(this.addressToAccount.values()).map((acc) => ({
      alias: '',
      item: acc.getAddress(),
    }));
  }
}
