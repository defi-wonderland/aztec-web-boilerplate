import { describe, it, expect } from 'vitest';
import { matchesPattern, matchesScope } from '../PatternMatcher';

describe('matchesPattern', () => {
  const addr = '0x1f4b000000000000000000000000000000000000000000000000000000000001';

  it('matches exact contract + exact function', () => {
    expect(matchesPattern({ contract: addr, function: 'transfer' }, addr, 'transfer')).toBe(true);
  });

  it('rejects wrong function', () => {
    expect(matchesPattern({ contract: addr, function: 'transfer' }, addr, 'mint')).toBe(false);
  });

  it('rejects wrong contract', () => {
    const other = '0x2b68000000000000000000000000000000000000000000000000000000000002';
    expect(matchesPattern({ contract: addr, function: 'transfer' }, other, 'transfer')).toBe(false);
  });

  it('matches wildcard function', () => {
    expect(matchesPattern({ contract: addr, function: '*' }, addr, 'anything')).toBe(true);
  });

  it('matches wildcard contract', () => {
    const other = '0x0000000000000000000000000000000000000000000000000000000000000099';
    expect(matchesPattern({ contract: '*', function: 'transfer' }, other, 'transfer')).toBe(true);
  });

  it('matches double wildcard', () => {
    expect(matchesPattern({ contract: '*', function: '*' }, addr, 'anything')).toBe(true);
  });
});

describe('matchesScope', () => {
  const addr = '0x1f4b000000000000000000000000000000000000000000000000000000000001';

  it('global wildcard scope matches everything', () => {
    expect(matchesScope('*', addr, 'transfer')).toBe(true);
  });

  it('matches if any pattern in array matches', () => {
    const scope = [
      { contract: addr, function: 'transfer' },
      { contract: addr, function: 'mint' },
    ];
    expect(matchesScope(scope, addr, 'mint')).toBe(true);
  });

  it('rejects if no pattern matches', () => {
    const scope = [
      { contract: addr, function: 'transfer' },
    ];
    expect(matchesScope(scope, addr, 'burn')).toBe(false);
  });

  it('empty array matches nothing', () => {
    expect(matchesScope([], addr, 'transfer')).toBe(false);
  });
});
