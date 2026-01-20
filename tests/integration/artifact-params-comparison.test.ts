import { describe, it } from 'vitest';
import { loadContractArtifact, type NoirCompiledContract } from '@aztec/aztec.js/abi';
import { FunctionSelector } from '@aztec/stdlib/abi';
import { DEVNET_CONFIG } from '../../src/config/networks/devnet';
import localDevnetDripper from '../../src/artifacts/devnet/dripper-Dripper.json';

const REGISTRY_URL = 'https://devnet.aztec-registry.xyz';

describe('Function Parameters Comparison', () => {
  it('should compare function parameters and selectors', async () => {
    const expectedClassId = DEVNET_CONFIG.classIds!.dripper;

    // 1. Local artifact after loadContractArtifact
    const localArtifact = loadContractArtifact(localDevnetDripper as NoirCompiledContract);

    // 2. Registry artifact
    const url = `${REGISTRY_URL}/api/artifacts/${expectedClassId}`;
    const response = await fetch(url);
    const registryArtifact = await response.json();

    console.log('\n=== FUNCTION PARAMETERS COMPARISON ===\n');

    for (const localFn of localArtifact.functions) {
      const registryFn = registryArtifact.functions.find((f: any) => f.name === localFn.name);
      if (!registryFn) continue;

      const localSelector = await FunctionSelector.fromNameAndParameters(localFn.name, localFn.parameters);
      const registrySelector = await FunctionSelector.fromNameAndParameters(registryFn.name, registryFn.parameters);

      console.log(`--- ${localFn.name} ---`);
      console.log(`Local params (${localFn.parameters.length}):`, JSON.stringify(localFn.parameters.map(p => ({name: p.name, kind: p.type.kind})), null, 2));
      console.log(`Registry params (${registryFn.parameters.length}):`, JSON.stringify(registryFn.parameters.map((p: any) => ({name: p.name, kind: p.type.kind})), null, 2));
      console.log(`Local selector: ${localSelector.toString()}`);
      console.log(`Registry selector: ${registrySelector.toString()}`);
      console.log(`Selectors match: ${localSelector.equals(registrySelector) ? '✅' : '❌'}`);
      console.log();
    }
  }, 120000);
});
