/**
 * Service for handling Aztec wallet storage operations
 */
import { Fr } from '@aztec/aztec.js';
import { IAztecStorageService, AccountData } from '../../../types/aztec';

export class AztecStorageService implements IAztecStorageService {
  private static readonly STORAGE_KEY = 'aztec-account';

  /**
   * Save account data to localStorage
   */
  saveAccount(accountData: AccountData): void {
    localStorage.setItem(AztecStorageService.STORAGE_KEY, JSON.stringify(accountData));
  }

  /**
   * Get account data from localStorage
   */
  getAccount(): AccountData | null {
    const data = localStorage.getItem(AztecStorageService.STORAGE_KEY);

    if(!data) {
      return null;
    }

    const accountData = JSON.parse(data) as AccountData;


    return accountData;
  }

  /**
   * Clear account data from localStorage
   */
  clearAccount(): void {
    localStorage.removeItem(AztecStorageService.STORAGE_KEY);
  }
}
