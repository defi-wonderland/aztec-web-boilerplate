import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildArgsFromInputs,
  parseArtifactSource,
  type ParsedField,
} from '../../src/utils/contractInteraction';

vi.mock('@aztec/aztec.js/abi', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@aztec/aztec.js/abi');
  return {
    ...actual,
    loadContractArtifact: vi.fn(() => ({ name: 'mock-artifact' })),
  };
});

describe('contractInteraction utils', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('parses artifact source and extracts functions', () => {
    const mockArtifact = {
      name: 'Mock',
      functions: [
        {
          name: 'mint',
          abi: {
            parameters: [
              {
                name: 'amount',
                type: { kind: 'integer', sign: 'unsigned', width: 64 },
              },
            ],
          },
          custom_attributes: ['public'],
          is_unconstrained: false,
        },
        {
          name: 'view_supply',
          abi: { parameters: [] },
          custom_attributes: [],
          is_unconstrained: true,
        },
      ],
    };

    const parsed = parseArtifactSource(JSON.stringify(mockArtifact));
    expect(parsed.functions).toHaveLength(2);
    expect(parsed.functions[0].inputs[0].type.kind).toBe('integer');
    expect(parsed.functions[1].isUnconstrained).toBe(true);
  });

  it('builds arguments with struct and address fields', () => {
    const zeroAddress =
      '0x0000000000000000000000000000000000000000000000000000000000000000';

    const inputs: ParsedField[] = [
      {
        path: 'recipient',
        label: 'recipient',
        type: { kind: 'address' },
      },
      {
        path: 'amount',
        label: 'amount',
        type: { kind: 'integer', sign: 'unsigned', width: 64 },
      },
      {
        path: 'meta',
        label: 'meta',
        type: {
          kind: 'struct',
          fields: [
            {
              path: 'note',
              label: 'note',
              type: { kind: 'string' },
            },
          ],
        },
      },
      {
        path: 'meta.note',
        label: 'note',
        type: { kind: 'string' },
      },
    ];

    const { args, errors } = buildArgsFromInputs(inputs, {
      recipient: zeroAddress,
      amount: '5',
      'meta.note': 'hello',
    });

    expect(errors).toHaveLength(0);
    expect(args[0]).toBe(zeroAddress);
    expect(args[1]).toBe(5n);
    expect(args[2]).toEqual({ note: 'hello' });
  });

  it('returns validation errors for invalid integers', () => {
    const inputs: ParsedField[] = [
      {
        path: 'amount',
        label: 'amount',
        type: { kind: 'integer', sign: 'unsigned', width: 64 },
      },
    ];

    const { errors } = buildArgsFromInputs(inputs, { amount: 'abc' });
    expect(errors).toHaveLength(1);
  });
});
