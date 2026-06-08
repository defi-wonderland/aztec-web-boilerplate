// Embedded wallet connector (@aztec/wallets/embedded).
// proverEnabled: true — the in-browser PXE generates real client-side proofs,
// so the same connector keeps working once you extend the base to send
// transactions (the read-only base never proves; the example tag will).
// `ephemeral` is left unset => the account persists in IndexedDB, so
// reconnecting reuses the existing Schnorr account.
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { Fr } from "@aztec/aztec.js/fields";
import type { ConnectOptions, ConnectResult, WalletConnector } from "./types";

export class EmbeddedConnector implements WalletConnector {
  readonly kind = "embedded" as const;
  readonly label = "Embedded wallet";

  async connect({ node }: ConnectOptions): Promise<ConnectResult> {
    // Use `pxe` (not the deprecated `pxeConfig`) in 4.3.0.
    const wallet = await EmbeddedWallet.create(node, {
      pxe: { proverEnabled: true },
    });

    // Reconnect: reuse a persisted account if present; otherwise create a
    // Schnorr account. The signing key is derived automatically when omitted.
    const accounts = await wallet.getAccounts();
    if (accounts.length === 0) {
      await wallet.createSchnorrAccount(Fr.random(), Fr.random());
    }

    // Return the full account list; the store auto-selects when there's one.
    return { wallet, accounts: await wallet.getAccounts() };
  }

  async disconnect(): Promise<void> {
    // No remote teardown nor local state to clean up: the account lives in
    // IndexedDB (persisted). The store resets its wallet reference.
  }
}
