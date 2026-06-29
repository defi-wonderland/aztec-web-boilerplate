// src/contracts/counter.ts
// All Counter contract interaction in one place: attach, read, write, register,
// deploy. The hooks in src/hooks/useCounter.ts call these; components never touch
// the contract API directly. Pure functions of (wallet, address, …) — no React,
// no store — so they're easy to test and reuse.
//
// Requires the generated artifact: `aztec codegen target -o src/contracts/artifacts`
// produces ./artifacts/Counter.ts (class CounterContract + CounterContractArtifact).
//
// Counter's Noir interface:
//   constructor(owner)  ·  get_owner() -> AztecAddress  ·  get_counter() -> u128  ·  increment()
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import type { TxReceipt } from '@aztec/aztec.js/tx';
import { CounterContract, CounterContractArtifact } from './artifacts/Counter';

/** Attach to an already-deployed Counter. NOTE: `.at` is SYNCHRONOUS in v5. */
export function counterAt(wallet: Wallet, address: AztecAddress): CounterContract {
  return CounterContract.at(address, wallet);
}

/**
 * Read the counter value. In v5 `simulate({ from })` resolves to a
 * `{ result, offchainEffects, offchainMessages }` wrapper — the decoded value (a `u128`
 * decodes to a JS `bigint`) is at `.result`, so destructure it. `includeMetadata: true`
 * only ADDS `stats`/`gasUsed`; the wrapper is always there. `from` (the caller) is
 * required even for a public read; pass the connected account's address.
 */
export async function readCounter(
  wallet: Wallet,
  address: AztecAddress,
  from: AztecAddress,
): Promise<bigint> {
  const { result } = await counterAt(wallet, address).methods.get_counter().simulate({ from });
  return result as bigint;
}

/**
 * Increment the counter (a state-changing tx). `.send()` waits for mining by
 * default and resolves to a `{ receipt, offchainEffects, offchainMessages }` wrapper —
 * read `.receipt` (no SentTx, no `.wait()` in v5). `from` is required. `paymentMethod` is
 * OPTIONAL: omit it to let the connected wallet pay (the default; correct for
 * external wallets and funded accounts); pass one (e.g. a sponsored FPC) only
 * when needed. See fees.ts / contracts.md §4.
 */
export async function incrementCounter(
  wallet: Wallet,
  address: AztecAddress,
  from: AztecAddress,
  paymentMethod?: FeePaymentMethod,
): Promise<TxReceipt> {
  const fee = paymentMethod ? { paymentMethod } : undefined;
  const { receipt } = await counterAt(wallet, address)
    .methods.increment()
    .send({ from, fee });
  // .send() throws on revert by default; this guards if you ever set dontThrowOnRevert.
  if (!receipt.hasExecutionSucceeded()) {
    throw new Error(receipt.error ?? 'increment reverted');
  }
  return receipt;
}

/**
 * Register a Counter the local PXE didn't deploy, so reads/writes work. Rebuild the
 * instance from the SAME instantiation params used at deploy time (salt + ctor
 * args derive the address). `registerContract` takes POSITIONAL args in v5.
 */
export async function registerCounter(
  wallet: Wallet,
  owner: AztecAddress,
  salt: Fr = new Fr(0n),
): Promise<AztecAddress> {
  const instance = await getContractInstanceFromInstantiationParams(CounterContractArtifact, {
    salt,
    constructorArgs: [owner],
  });
  await wallet.registerContract(instance, CounterContractArtifact);
  return instance.address;
}

/**
 * Deploy a fresh Counter. In v5 the typed `.deploy()` takes the constructor args plus
 * an optional `instantiation` object (`{ salt, deployer, … }`) — the salt goes THERE,
 * NOT in `.send()`. `.send()` resolves to a `{ contract, instance, receipt, … }` wrapper
 * (read `.contract`); there is no `.deployed()`, no `contractAddressSalt`, and no
 * `returnReceipt`/`DeployTxReceipt` — the receipt is already on the result as `.receipt`.
 * Returns the new address; persist it (and the salt) to reattach later.
 */
export async function deployCounter(
  wallet: Wallet,
  from: AztecAddress,
  owner: AztecAddress,
  paymentMethod?: FeePaymentMethod, // omit to let the wallet/account pay; see fees.ts
  salt: Fr = Fr.random(),
): Promise<{ address: AztecAddress; salt: Fr }> {
  const fee = paymentMethod ? { paymentMethod } : undefined;
  const { contract } = await CounterContract
    .deploy(wallet, owner, { salt }) // ctor args + instantiation ({ salt, … }); salt goes HERE, not in .send()
    .send({ from, fee });
  return { address: contract.address, salt };
}
