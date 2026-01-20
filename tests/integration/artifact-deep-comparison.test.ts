import { describe, it } from 'vitest';
import { loadContractArtifact, type NoirCompiledContract } from '@aztec/aztec.js/abi';
import { getContractClassFromArtifact } from '@aztec/aztec.js/contracts';
import { computeArtifactHash, computeArtifactHashPreimage } from '@aztec/stdlib/contract';
import { DEVNET_CONFIG } from '../../src/config/networks/devnet';

import localDevnetDripper from '../../src/artifacts/devnet/dripper-Dripper.json';

const REGISTRY_URL = 'https://devnet.aztec-registry.xyz';

describe('Deep Artifact Comparison', () => {
  it('should compare artifact hash components', async () => {
    const expectedClassId = DEVNET_CONFIG.classIds!.dripper;

    console.log('\n=== ARTIFACT HASH COMPONENT COMPARISON ===');

    // 1. Local artifact
    const localArtifact = loadContractArtifact(localDevnetDripper as NoirCompiledContract);
    const localPreimage = await computeArtifactHashPreimage(localArtifact);
    const localHash = await computeArtifactHash(localArtifact);
    const localClass = await getContractClassFromArtifact(localArtifact);

    console.log('\n--- LOCAL ---');
    console.log('privateFunctionRoot:', localPreimage.privateFunctionRoot.toString());
    console.log('utilityFunctionRoot:', localPreimage.utilityFunctionRoot.toString());
    console.log('metadataHash:', localPreimage.metadataHash.toString());
    console.log('artifactHash:', localHash.toString());
    console.log('classId:', localClass.id.toString());

    // 2. Registry artifact
    const url = `${REGISTRY_URL}/api/artifacts/${expectedClassId}`;
    const response = await fetch(url);
    const registryArtifact = await response.json();

    const registryPreimage = await computeArtifactHashPreimage(registryArtifact);
    const registryHash = await computeArtifactHash(registryArtifact);
    const registryClass = await getContractClassFromArtifact(registryArtifact);

    console.log('\n--- REGISTRY ---');
    console.log('privateFunctionRoot:', registryPreimage.privateFunctionRoot.toString());
    console.log('utilityFunctionRoot:', registryPreimage.utilityFunctionRoot.toString());
    console.log('metadataHash:', registryPreimage.metadataHash.toString());
    console.log('artifactHash:', registryHash.toString());
    console.log('classId:', registryClass.id.toString());

    // 3. Compare
    console.log('\n--- COMPARISON ---');
    console.log('privateFunctionRoot match:', localPreimage.privateFunctionRoot.equals(registryPreimage.privateFunctionRoot) ? '✅' : '❌');
    console.log('utilityFunctionRoot match:', localPreimage.utilityFunctionRoot.equals(registryPreimage.utilityFunctionRoot) ? '✅' : '❌');
    console.log('metadataHash match:', localPreimage.metadataHash.equals(registryPreimage.metadataHash) ? '✅' : '❌');
    console.log('artifactHash match:', localHash.equals(registryHash) ? '✅' : '❌');
    console.log('classId match:', localClass.id.equals(registryClass.id) ? '✅' : '❌');

    // 4. Deep compare functions
    console.log('\n--- FUNCTION DETAILS ---');
    for (const localFn of localArtifact.functions) {
      const registryFn = registryArtifact.functions.find((f: any) => f.name === localFn.name);
      if (!registryFn) {
        console.log(`${localFn.name}: ❌ Missing in registry`);
        continue;
      }

      // Convert to comparable format
      const localBytecode = typeof localFn.bytecode === 'string' ? localFn.bytecode : Buffer.from(localFn.bytecode).toString('base64');
      const registryBytecode = typeof registryFn.bytecode === 'string' ? registryFn.bytecode : Buffer.from(registryFn.bytecode).toString('base64');

      const bytecodeMatch = localBytecode === registryBytecode;
      const vkMatch = localFn.verificationKey === registryFn.verificationKey;

      console.log(`${localFn.name}:`);
      console.log(`  bytecode length: local=${localBytecode.length} registry=${registryBytecode.length} match=${bytecodeMatch ? '✅' : '❌'}`);
      console.log(`  verificationKey: ${vkMatch ? '✅' : '❌'}`);

      if (!vkMatch && localFn.verificationKey && registryFn.verificationKey) {
        console.log(`    local VK length: ${localFn.verificationKey.length}`);
        console.log(`    registry VK length: ${registryFn.verificationKey.length}`);
      }
    }
  }, 120000);
});
