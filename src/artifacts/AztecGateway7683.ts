/**
 * Minimal AztecGateway7683 Contract Artifact
 * Used for registering and interacting with the Aztec Gateway
 */

import { type NoirCompiledContract } from '@aztec/aztec.js';

// Minimal artifact for gateway registration
// Full implementation would come from compiled Noir contract
export const AztecGateway7683ContractArtifact: NoirCompiledContract = {
  name: 'AztecGateway7683',
  functions: [
    {
      name: 'open',
      functionType: 'public',
      isInternal: false,
      parameters: [
        { name: 'order_data', type: { kind: 'array', length: 13, type: { kind: 'field' } } },
        { name: 'order_data_type', type: { kind: 'string', length: 32 } },
        { name: 'fill_deadline', type: { kind: 'field' } },
      ],
      returnTypes: [],
      bytecode: '',
      debugSymbols: '',
    },
    {
      name: 'open_private',
      functionType: 'public',
      isInternal: false,
      parameters: [
        { name: 'order_data', type: { kind: 'array', length: 13, type: { kind: 'field' } } },
        { name: 'order_data_type', type: { kind: 'string', length: 32 } },
        { name: 'fill_deadline', type: { kind: 'field' } },
      ],
      returnTypes: [],
      bytecode: '',
      debugSymbols: '',
    },
    {
      name: 'get_order_status',
      functionType: 'public',
      isInternal: false,
      parameters: [
        { name: 'order_id', type: { kind: 'field' } },
      ],
      returnTypes: [{ kind: 'field' }],
      bytecode: '',
      debugSymbols: '',
    },
    {
      name: 'claim_private',
      functionType: 'public',
      isInternal: false,
      parameters: [
        { name: 'order_id', type: { kind: 'field' } },
        { name: 'secret', type: { kind: 'field' } },
      ],
      returnTypes: [],
      bytecode: '',
      debugSymbols: '',
    },
    {
      name: 'refund',
      functionType: 'public',
      isInternal: false,
      parameters: [
        { name: 'order_id', type: { kind: 'field' } },
      ],
      returnTypes: [],
      bytecode: '',
      debugSymbols: '',
    },
  ],
  events: [],
  fileMap: {},
  storageLayout: {
    storage: [],
  },
  notes: {},
};