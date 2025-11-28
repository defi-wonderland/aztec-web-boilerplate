import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AztecTokenService } from '../../../src/services/aztec/features/AztecTokenService';

vi.mock('@defi-wonderland/aztec-standards/current/artifacts/Token.js', () => ({
  TokenContract: {
    at: vi.fn()
  }
}));

vi.mock('@aztec/noir-contracts.js/Token', () => ({
  TokenContract: {
    at: vi.fn()
  }
}));

vi.mock('@aztec/aztec.js', () => ({
  AztecAddress: {
    fromString: vi.fn((addr: string) => ({ toString: () => addr }))
  }
}));

describe('AztecTokenService', () => {
  let service: AztecTokenService;
  let mockGetConnectedAccount: ReturnType<typeof vi.fn>;
  let mockTokenContract: {
    methods: {
      balance_of_private: ReturnType<typeof vi.fn>;
      balance_of_public: ReturnType<typeof vi.fn>;
    };
  };

  const TOKEN_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
  const OWNER_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12';

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTokenContract = {
      methods: {
        balance_of_private: vi.fn(),
        balance_of_public: vi.fn()
      }
    };

    mockGetConnectedAccount = vi.fn();
    service = new AztecTokenService(mockGetConnectedAccount);

    const { TokenContract } = await import('@defi-wonderland/aztec-standards/current/artifacts/Token.js');
    vi.mocked(TokenContract.at).mockResolvedValue(mockTokenContract as never);

    const { TokenContract: AztecTokenContract } = await import('@aztec/noir-contracts.js/Token');
    vi.mocked(AztecTokenContract.at).mockResolvedValue(mockTokenContract as never);
  });

  describe('getPrivateBalance', () => {
    it('returns balance when account is connected', async () => {
      mockGetConnectedAccount.mockReturnValue({});
      mockTokenContract.methods.balance_of_private.mockReturnValue({
        simulate: vi.fn().mockResolvedValue(1000n)
      });

      const balance = await service.getPrivateBalance(TOKEN_ADDRESS, OWNER_ADDRESS);

      expect(balance).toBe(1000n);
      expect(mockTokenContract.methods.balance_of_private).toHaveBeenCalled();
    });

    it('throws error when no account connected', async () => {
      mockGetConnectedAccount.mockReturnValue(null);

      await expect(service.getPrivateBalance(TOKEN_ADDRESS, OWNER_ADDRESS))
        .rejects.toThrow('No account connected');
    });
  });

  describe('getPublicBalance', () => {
    it('returns balance when account is connected', async () => {
      mockGetConnectedAccount.mockReturnValue({});
      mockTokenContract.methods.balance_of_public.mockReturnValue({
        simulate: vi.fn().mockResolvedValue(2000n)
      });

      const balance = await service.getPublicBalance(TOKEN_ADDRESS, OWNER_ADDRESS);

      expect(balance).toBe(2000n);
      expect(mockTokenContract.methods.balance_of_public).toHaveBeenCalled();
    });

    it('throws error when no account connected', async () => {
      mockGetConnectedAccount.mockReturnValue(null);

      await expect(service.getPublicBalance(TOKEN_ADDRESS, OWNER_ADDRESS))
        .rejects.toThrow('No account connected');
    });
  });

  describe('getWethPrivateBalance', () => {
    it('returns balance when account is connected', async () => {
      mockGetConnectedAccount.mockReturnValue({});
      mockTokenContract.methods.balance_of_private.mockReturnValue({
        simulate: vi.fn().mockResolvedValue(500n)
      });

      const balance = await service.getWethPrivateBalance(TOKEN_ADDRESS, OWNER_ADDRESS);

      expect(balance).toBe(500n);
    });

    it('returns 0n on error', async () => {
      mockGetConnectedAccount.mockReturnValue({});
      mockTokenContract.methods.balance_of_private.mockReturnValue({
        simulate: vi.fn().mockRejectedValue(new Error('Contract error'))
      });

      const balance = await service.getWethPrivateBalance(TOKEN_ADDRESS, OWNER_ADDRESS);

      expect(balance).toBe(0n);
    });

    it('throws error when account not available', async () => {
      mockGetConnectedAccount.mockReturnValue(null);

      await expect(service.getWethPrivateBalance(TOKEN_ADDRESS, OWNER_ADDRESS))
        .rejects.toThrow('Account not available');
    });
  });

  describe('getWethPublicBalance', () => {
    it('returns balance when account is connected', async () => {
      mockGetConnectedAccount.mockReturnValue({});
      mockTokenContract.methods.balance_of_public.mockReturnValue({
        simulate: vi.fn().mockResolvedValue(750n)
      });

      const balance = await service.getWethPublicBalance(TOKEN_ADDRESS, OWNER_ADDRESS);

      expect(balance).toBe(750n);
    });

    it('returns 0n on error', async () => {
      mockGetConnectedAccount.mockReturnValue({});
      mockTokenContract.methods.balance_of_public.mockReturnValue({
        simulate: vi.fn().mockRejectedValue(new Error('Contract error'))
      });

      const balance = await service.getWethPublicBalance(TOKEN_ADDRESS, OWNER_ADDRESS);

      expect(balance).toBe(0n);
    });

    it('throws error when account not available', async () => {
      mockGetConnectedAccount.mockReturnValue(null);

      await expect(service.getWethPublicBalance(TOKEN_ADDRESS, OWNER_ADDRESS))
        .rejects.toThrow('Account not available');
    });
  });
});

