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

  // Active wallet, kept so disconnect() can stop its in-browser PXE.
  private wallet: EmbeddedWallet | null = null;

  async connect({ node }: ConnectOptions): Promise<ConnectResult> {
    // Tear down a previous PXE before spinning up a new one (e.g. on a
    // network switch -> reconnect) so prover/worker resources don't leak.
    if (this.wallet) {
      await this.wallet.stop().catch((err) => {
        console.warn("Failed to stop previous embedded wallet", err);
      });
      this.wallet = null;
    }

    let wallet: EmbeddedWallet | null = null;
    try {
      // Use the unified `pxe` option required by current EmbeddedWalletOptions.
      wallet = await EmbeddedWallet.create(node, {
        pxe: { proverEnabled: true },
      });
      this.wallet = wallet;

      // Reconnect: reuse a persisted account if present; otherwise create a
      // Schnorr account. The signing key is derived automatically when omitted.
      const accounts = await wallet.getAccounts();
      if (accounts.length === 0) {
        await wallet.createSchnorrAccount(Fr.random(), Fr.random());
      }

      const connectedWallet = wallet;
      // Return the full account list; the store auto-selects when there's one.
      return {
        wallet: connectedWallet,
        accounts: await wallet.getAccounts(),
        disconnect: async () => {
          await connectedWallet.stop();
          if (this.wallet === connectedWallet) this.wallet = null;
        },
      };
    } catch (err) {
      if (wallet) {
        await wallet.stop().catch((stopErr) => {
          console.warn("Failed to stop embedded wallet after connect failure", stopErr);
        });
        if (this.wallet === wallet) this.wallet = null;
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    // Stop the in-browser PXE (prover + workers) so it doesn't leak across
    // reconnects. The account itself stays in IndexedDB (persisted), so a
    // later reconnect reuses the same Schnorr account.
    if (this.wallet) {
      const wallet = this.wallet;
      this.wallet = null;
      await wallet.stop();
    }
  }
}
