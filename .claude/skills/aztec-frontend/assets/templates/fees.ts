// src/contracts/fees.ts
// Resolves the fee payment for a write. Fee payment is a per-network, per-wallet
// STRATEGY — NOT a guarantee that "sponsored fees" always work. See
// references/contracts.md §4 for the full picture. The short version:
//
//   • External/extension wallets (Azguard/Obsidion) manage and PROMPT for fees
//     themselves — never inject a payment method, or you fight the wallet.
//   • The embedded wallet's account pays from its OWN fee juice when you omit a
//     payment method — but a fresh account has none until it's funded (faucet/
//     L1 bridge). A sponsored FPC can pay instead, IF one is deployed + funded +
//     registered on the target network (a testing/dev convenience, not universal).
//
// So the default here is `undefined` (let the wallet/account decide), and a
// sponsored FPC is used only when explicitly configured for the active network.
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getNetwork } from '../config/app';
import type { ConnectorKind } from '../lib/connectors/types';

/**
 * Resolve a FeePaymentMethod for the active wallet + network, or `undefined` to
 * let the connected wallet pay (the robust default).
 *
 * Returning a SponsoredFeePaymentMethod only makes sense when `network.sponsoredFpc`
 * points at an FPC that is actually deployed AND funded on that network. For the
 * EMBEDDED wallet you must ALSO register that FPC in the PXE before it works
 * (`wallet.registerContract(instance, SponsoredFPCContractArtifact)`), which needs
 * the artifact from `@aztec/noir-contracts.js` (not a dependency here). External
 * wallets handle all of that themselves — so we never override them.
 */
export function resolveFeePaymentMethod(
  connectorKind: ConnectorKind | null,
  networkId: string,
): FeePaymentMethod | undefined {
  // External/extension wallets own fee selection — never inject one.
  if (connectorKind === 'external') return undefined;
  // Embedded: use a configured sponsored FPC if present, else let the account
  // pay from its own fee juice (works only once the account is funded).
  const fpc = getNetwork(networkId).sponsoredFpc;
  if (!fpc) return undefined;
  return new SponsoredFeePaymentMethod(AztecAddress.fromString(fpc));
}

/**
 * Turn a fee error (unfunded account / missing-or-empty FPC) into an actionable
 * message instead of a cryptic simulation/proving failure. v5 doesn't expose a
 * typed fee error, so this matches broadly — keep the heuristic, not the exact text.
 */
export function explainFeeError(err: unknown, networkId: string): Error {
  const msg = String((err as Error)?.message ?? err);
  const m = msg.toLowerCase();
  if (m.includes('fee') || m.includes('gas') || m.includes('balance') || m.includes('insufficient') || m.includes('sponsor')) {
    return new Error(
      `Couldn't pay transaction fees on "${networkId}". The account has no fee juice and no funded ` +
        `sponsored FPC is configured for this network. Fund the account (faucet / L1 bridge), configure a ` +
        `sponsored FPC in config/app.ts, or connect an external wallet that pays fees itself.`,
    );
  }
  return err instanceof Error ? err : new Error(msg);
}
