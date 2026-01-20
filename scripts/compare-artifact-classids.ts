/**
 * Script to compare classIds generated from local vs remote artifacts.
 *
 * Usage: npx tsx scripts/compare-artifact-classids.ts
 */

import { loadContractArtifact, type ContractArtifact, type NoirCompiledContract } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { Point } from '@aztec/foundation/curves/grumpkin';
import { PublicKeys } from '@aztec/stdlib/keys';
import { BarretenbergSync } from '@aztec/bb.js';

import localDripperJson from '../src/artifacts/devnet/dripper-Dripper.json' with { type: 'json' };

const REMOTE_ARTIFACT_URL =
  'https://devnet.aztec-registry.xyz/api/artifacts/0x1d1014602e766124a9a52429708ed416708b39e3e6ad88fcbf7757af093062e5';

const DEVNET_DRIPPER_CONFIG = {
  salt: 1337,
  deployer: AztecAddress.ZERO,
  constructorArgs: [] as unknown[],
  constructorArtifact: 'constructor',
  publicKeys: {
    masterNullifierPublicKey:
      '0x01498945581e0eb9f8427ad6021184c700ef091d570892c437d12c7d90364bbd170ae506787c5c43d6ca9255d571c10fa9ffa9d141666e290c347c5c9ab7e344',
    masterIncomingViewingPublicKey:
      '0x00c044b05b6ca83b9c2dbae79cc1135155956a64e136819136e9947fe5e5866c1c1f0ca244c7cd46b682552bff8ae77dea40b966a71de076ec3b7678f2bdb151',
    masterOutgoingViewingPublicKey:
      '0x1b00316144359e9a3ec8e49c1cdb7eeb0cedd190dfd9dc90eea5115aa779e287080ffc74d7a8b0bccb88ac11f45874172f3847eb8b92654aaa58a3d2b8dc7833',
    masterTaggingPublicKey:
      '0x019c111f36ad3fc1d9b7a7a14344314d2864b94f030594cd67f753ef774a1efb2039907fe37f08d10739255141bb066c506a12f7d1e8dfec21abc58494705b6f',
  },
};

async function buildPublicKeys(): Promise<PublicKeys> {
  await BarretenbergSync.initSingleton();

  const keys = DEVNET_DRIPPER_CONFIG.publicKeys;
  return new PublicKeys(
    Point.fromString(keys.masterNullifierPublicKey),
    Point.fromString(keys.masterIncomingViewingPublicKey),
    Point.fromString(keys.masterOutgoingViewingPublicKey),
    Point.fromString(keys.masterTaggingPublicKey)
  );
}

async function fetchRemoteArtifact(): Promise<ContractArtifact> {
  console.log(`Fetching remote artifact from: ${REMOTE_ARTIFACT_URL}`);
  const response = await fetch(REMOTE_ARTIFACT_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch remote artifact: ${response.status} ${response.statusText}`);
  }

  const artifact = (await response.json()) as ContractArtifact;
  console.log(`Remote artifact fetched: ${artifact.name}`);
  return artifact;
}

function loadLocalArtifact(): ContractArtifact {
  console.log('Loading local artifact from: src/artifacts/devnet/dripper-Dripper.json');
  const artifact = loadContractArtifact(localDripperJson as NoirCompiledContract);
  console.log(`Local artifact loaded: ${artifact.name}`);
  return artifact;
}

async function computeInstanceFromArtifact(
  artifact: ContractArtifact,
  publicKeys: PublicKeys,
  label: string
) {
  console.log(`\nComputing instance for: ${label}`);

  const instance = await getContractInstanceFromInstantiationParams(artifact, {
    salt: Fr.fromString(String(DEVNET_DRIPPER_CONFIG.salt)),
    deployer: DEVNET_DRIPPER_CONFIG.deployer,
    constructorArgs: DEVNET_DRIPPER_CONFIG.constructorArgs,
    constructorArtifact: DEVNET_DRIPPER_CONFIG.constructorArtifact,
    publicKeys,
  });

  console.log(`[${label}] Instance computed:`, {
    address: instance.address.toString(),
    classId: instance.currentContractClassId.toString(),
    initHash: instance.initializationHash.toString(),
  });

  return instance;
}

async function main() {
  console.log('='.repeat(80));
  console.log('ARTIFACT CLASS ID COMPARISON TEST');
  console.log('='.repeat(80));

  console.log('\n--- Building public keys ---');
  const publicKeys = await buildPublicKeys();
  console.log('Public keys hash:', publicKeys.hash().toString());

  console.log('\n--- Loading artifacts ---');
  const localArtifact = loadLocalArtifact();
  const remoteArtifact = await fetchRemoteArtifact();

  console.log('\n--- Computing instances ---');
  const localInstance = await computeInstanceFromArtifact(localArtifact, publicKeys, 'LOCAL');
  const remoteInstance = await computeInstanceFromArtifact(remoteArtifact, publicKeys, 'REMOTE');

  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON RESULTS');
  console.log('='.repeat(80));

  const localClassId = localInstance.currentContractClassId.toString();
  const remoteClassId = remoteInstance.currentContractClassId.toString();

  console.log(`\nLocal classId:  ${localClassId}`);
  console.log(`Remote classId: ${remoteClassId}`);

  const classIdsMatch = localClassId === remoteClassId;

  console.log(`\nAddresses match: ${localInstance.address.equals(remoteInstance.address)}`);
  console.log(`ClassIds match:  ${classIdsMatch}`);

  console.log('\n' + '='.repeat(80));

  if (classIdsMatch) {
    console.log('✅ PASS: Local and remote artifacts produce the same classId');
    process.exit(0);
  } else {
    console.log('❌ FAIL: Local and remote artifacts produce DIFFERENT classIds');
    console.log('\nThis means the local artifact does not match the deployed contract.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
