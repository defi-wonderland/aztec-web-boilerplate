import { describe, it, expect } from 'vitest';
import { loadContractArtifact, type NoirCompiledContract } from '@aztec/aztec.js/abi';
import { getContractClassFromArtifact } from '@aztec/aztec.js/contracts';
import { DEVNET_CONFIG } from '../../src/config/networks/devnet';

// Import local artifacts
import localDevnetDripper from '../../src/artifacts/devnet/dripper-Dripper.json';

const REGISTRY_URL = 'https://devnet.aztec-registry.xyz';

describe('ClassId Comparison: Local vs Registry', () => {
  it('should compare dripper classIds', async () => {
    const expectedClassId = DEVNET_CONFIG.classIds!.dripper;

    console.log('\n=== DRIPPER CLASSID COMPARISON ===');
    console.log('Config expects:', expectedClassId);

    // 1. Compute classId from LOCAL devnet artifact
    console.log('\n--- LOCAL DEVNET ARTIFACT ---');
    const localArtifact = loadContractArtifact(localDevnetDripper as NoirCompiledContract);
    console.log('Local artifact functions:', localArtifact.functions.length);
    console.log('Local artifact nonDispatchPublicFunctions:', localArtifact.nonDispatchPublicFunctions?.length);
    console.log('Local functions:', localArtifact.functions.map(f => `${f.name} (${f.functionType})`));

    const localContractClass = await getContractClassFromArtifact(localArtifact);
    const localClassId = localContractClass.id.toString();
    console.log('Local classId:', localClassId);
    console.log('Local matches config:', localClassId === expectedClassId ? '✅' : '❌');

    // 2. Fetch and compute classId from REGISTRY artifact
    console.log('\n--- REGISTRY ARTIFACT ---');
    const url = `${REGISTRY_URL}/api/artifacts/${expectedClassId}`;
    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const registryArtifact = await response.json();
    console.log('Registry artifact functions:', registryArtifact.functions.length);
    console.log('Registry artifact nonDispatchPublicFunctions:', registryArtifact.nonDispatchPublicFunctions?.length);
    console.log('Registry functions:', registryArtifact.functions.map((f: any) => `${f.name} (${f.functionType})`));

    const registryContractClass = await getContractClassFromArtifact(registryArtifact);
    const registryClassId = registryContractClass.id.toString();
    console.log('Registry classId:', registryClassId);
    console.log('Registry matches config:', registryClassId === expectedClassId ? '✅' : '❌');

    // 3. Compare artifacts
    console.log('\n--- COMPARISON ---');
    console.log('Local classId:    ', localClassId);
    console.log('Registry classId: ', registryClassId);
    console.log('ClassIds match:   ', localClassId === registryClassId ? '✅ YES' : '❌ NO');

    // 4. Detailed comparison
    console.log('\n--- DETAILED DIFF ---');

    // Compare function counts
    console.log('Functions count - Local:', localArtifact.functions.length, 'Registry:', registryArtifact.functions.length);

    // Compare each function
    for (const localFn of localArtifact.functions) {
      const registryFn = registryArtifact.functions.find((f: any) => f.name === localFn.name);
      if (!registryFn) {
        console.log(`  ❌ ${localFn.name}: Missing in registry`);
        continue;
      }

      const bytecodeMatch = localFn.bytecode === registryFn.bytecode;
      const vkMatch = localFn.verificationKey === registryFn.verificationKey;
      const typeMatch = localFn.functionType === registryFn.functionType;

      if (!bytecodeMatch || !vkMatch || !typeMatch) {
        console.log(`  ❌ ${localFn.name}:`);
        if (!typeMatch) console.log(`     functionType: local=${localFn.functionType} registry=${registryFn.functionType}`);
        if (!bytecodeMatch) console.log(`     bytecode differs`);
        if (!vkMatch) console.log(`     verificationKey differs`);
      } else {
        console.log(`  ✅ ${localFn.name}: identical`);
      }
    }

    // Check for extra functions in registry
    for (const registryFn of registryArtifact.functions) {
      const localFn = localArtifact.functions.find(f => f.name === registryFn.name);
      if (!localFn) {
        console.log(`  ❌ ${registryFn.name}: Extra in registry (not in local)`);
      }
    }
  }, 120000);
});
