/**
 * Service for handling Aztec wallet storage operations
 *
 * ⚠️ SECURITY WARNING: Account keys are stored in localStorage in plain text.
 * This is suitable for TESTNET ONLY. For production apps with real funds,
 * use an external wallet provider (like Azguard).
 *
 * The embedded wallet is designed for development and demonstration purposes.
 */
import { IAztecStorageService, AccountData } from '../../../types/aztec';

export class AztecStorageService implements IAztecStorageService {
  private static readonly STORAGE_KEY = 'aztec-account';
  private static readonly SENDERS_STORAGE_KEY = 'aztec-senders';

  /**
   * Save account data to localStorage
   * ⚠️ Keys are stored in plain text - testnet only!
   */
  saveAccount(accountData: AccountData): void {
    localStorage.setItem(
      AztecStorageService.STORAGE_KEY,
      JSON.stringify(accountData)
    );
  }

  /**
   * Get account data from localStorage
   */
  getAccount(): AccountData | null {
    const data = localStorage.getItem(AztecStorageService.STORAGE_KEY);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as AccountData;
    } catch (error) {
      console.error('Failed to parse account data:', error);
      this.clearAccount();
      return null;
    }
  }

  /**
   * Clear account data from localStorage
   */
  clearAccount(): void {
    localStorage.removeItem(AztecStorageService.STORAGE_KEY);
  }

  /**
   * Save senders array to localStorage
   */
  saveSenders(senders: string[]): void {
    localStorage.setItem(
      AztecStorageService.SENDERS_STORAGE_KEY,
      JSON.stringify(senders)
    );
  }

  /**
   * Get senders array from localStorage
   */
  getSenders(): string[] {
    const data = localStorage.getItem(AztecStorageService.SENDERS_STORAGE_KEY);
    if (!data) {
      return [];
    }
    try {
      return JSON.parse(data) as string[];
    } catch (error) {
      console.warn('Failed to parse saved senders:', error);
      return [];
    }
  }

  /**
   * Add a new sender to the stored list
   */
  addSender(sender: string): void {
    const existingSenders = this.getSenders();
    if (!existingSenders.includes(sender)) {
      existingSenders.push(sender);
      this.saveSenders(existingSenders);
    }
  }

  /**
   * Remove a sender from the stored list
   */
  removeSender(sender: string): void {
    const existingSenders = this.getSenders();
    const filteredSenders = existingSenders.filter((s) => s !== sender);
    this.saveSenders(filteredSenders);
  }

  /**
   * Clear all saved senders from localStorage
   */
  clearSenders(): void {
    localStorage.removeItem(AztecStorageService.SENDERS_STORAGE_KEY);
  }
}
