// External wallet connector (@aztec/wallet-sdk/manager — WalletManager).
// Azguard-style flow: discovery via extension -> secure-channel handshake ->
// emoji verification -> confirm() -> Wallet.
import { WalletManager, type WalletProvider } from "@aztec/wallet-sdk/manager";
import { hashToEmoji } from "@aztec/wallet-sdk/crypto";
import type {
  AppCapabilities,
  GrantedAccountsCapability,
} from "@aztec/aztec.js/wallet";
import { getChainInfo } from "../../services/node";
import { APP_ID, DISCOVERY_TIMEOUT_MS } from "../../config/app";
import type { ConnectOptions, ConnectResult, WalletConnector } from "./types";

/** Take the first provider from the async iterator, or null if discovery is empty. */
async function firstProvider(
  wallets: AsyncIterable<WalletProvider>
): Promise<WalletProvider | null> {
  for await (const provider of wallets) {
    return provider;
  }
  return null;
}

export class ExternalConnector implements WalletConnector {
  readonly kind = "external" as const;
  readonly label = "Azguard";

  // Active provider, kept so disconnect() can tear it down.
  private provider: WalletProvider | null = null;

  async connect({ node, onEmojiGrid }: ConnectOptions): Promise<ConnectResult> {
    let provider: WalletProvider | null = null;
    try {
      const chainInfo = await getChainInfo(node);
      const discovery = WalletManager.configure({
        extensions: { enabled: true },
      }).getAvailableWallets({
        chainInfo,
        appId: APP_ID,
        timeout: DISCOVERY_TIMEOUT_MS,
      });

      provider = await firstProvider(discovery.wallets);
      discovery.cancel();
      if (!provider) {
        throw new Error("No external wallet found");
      }
      // Tear down any previous provider before replacing it, so its secure
      // channel doesn't orphan (this connector is a long-lived singleton, so
      // a reconnect without an explicit disconnect would overwrite it).
      if (this.provider) {
        const previousProvider = this.provider;
        this.provider = null;
        await previousProvider.disconnect().catch((err) => {
          console.warn("Failed to disconnect previous external wallet provider", err);
        });
      }
      this.provider = provider;

      // Handshake: establish the secure channel (key exchange).
      const pending = await provider.establishSecureChannel(APP_ID);

      // Show the emoji grid for the user to compare against their wallet — but do
      // NOT block on a confirm button. We proceed straight to confirm(), which
      // hands control to the wallet (Azguard) to approve the connection + grant
      // capabilities below. The grid stays on screen (the UI keeps it open while
      // status === 'connecting') so the user can compare while the wallet prompts.
      onEmojiGrid?.(hashToEmoji(pending.verificationHash));

      const wallet = await pending.confirm();

      // External wallets (Azguard) use a capability/permission model: the dApp must
      // declare upfront which methods it needs. Without this, getAccounts() fails with
      // "Unauthorized method/chain". We request the `accounts` capability — the
      // wallet shows a permission prompt and returns the granted accounts.
      const manifest: AppCapabilities = {
        version: "1.0",
        metadata: {
          name: "web-boiler",
          version: "0.1.0",
          description: "Aztec frontend boilerplate",
        },
        capabilities: [
          { type: "accounts", canGet: true, canCreateAuthWit: true },
        ],
      };
      const response = await wallet.requestCapabilities(manifest);

      const accountsCap = response.granted.find(
        (cap): cap is GrantedAccountsCapability => cap.type === "accounts"
      );
      const accounts = accountsCap?.accounts ?? [];
      if (accounts.length === 0) {
        throw new Error("No accounts granted by the external wallet");
      }
      const connectedProvider = provider;
      // Return ALL granted accounts; the store lets the user pick which one
      // (the wallet may grant several). No more silent accounts[0].
      return {
        wallet,
        accounts,
        disconnect: async () => {
          await connectedProvider.disconnect();
          if (this.provider === connectedProvider) this.provider = null;
        },
      };
    } catch (err) {
      if (provider) {
        await provider.disconnect().catch((disconnectErr) => {
          console.warn("Failed to disconnect external provider after connect failure", disconnectErr);
        });
        if (this.provider === provider) this.provider = null;
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.provider) {
      const provider = this.provider;
      this.provider = null;
      await provider.disconnect();
    }
  }
}
