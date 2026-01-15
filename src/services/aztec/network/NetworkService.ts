import { createLogger } from '@aztec/aztec.js/log';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';

const logger = createLogger('network-service');

class NetworkServiceClass {
  private nodeClients: Map<string, AztecNode> = new Map();
  private checkPromises: Map<string, Promise<void>> = new Map();

  private normalizeUrl(nodeUrl: string): string {
    if (!nodeUrl) return nodeUrl;
    return nodeUrl.endsWith('/') ? nodeUrl.slice(0, -1) : nodeUrl;
  }

  /**
   * Get or create an AztecNode client for a given URL.
   * Clients are cached by URL.
   */
  getNodeClient(nodeUrl: string): AztecNode {
    const normalizedUrl = this.normalizeUrl(nodeUrl);
    const existing = this.nodeClients.get(normalizedUrl);

    if (existing) {
      return existing;
    }

    const client = createAztecNodeClient(normalizedUrl);
    this.nodeClients.set(normalizedUrl, client);
    logger.info(`Created AztecNode client for ${normalizedUrl}`);

    return client;
  }

  /**
   * Check if the network is available by pinging the node.
   * Deduplicates concurrent checks for the same URL.
   */
  async checkAvailability(nodeUrl: string): Promise<void> {
    const normalizedUrl = this.normalizeUrl(nodeUrl);

    const existingCheck = this.checkPromises.get(normalizedUrl);
    if (existingCheck) {
      return existingCheck;
    }

    const checkPromise = this.performCheck(normalizedUrl);
    this.checkPromises.set(normalizedUrl, checkPromise);

    try {
      await checkPromise;
    } finally {
      this.checkPromises.delete(normalizedUrl);
    }
  }

  private async performCheck(nodeUrl: string): Promise<void> {
    const client = this.getNodeClient(nodeUrl);
    const nodeInfo = await client.getNodeInfo();
    logger.info(`Network available: ${nodeUrl}`, nodeInfo);
  }

  /**
   * Clear cached client for a specific URL.
   */
  clearClient(nodeUrl: string): void {
    const normalizedUrl = this.normalizeUrl(nodeUrl);
    this.nodeClients.delete(normalizedUrl);
    logger.info(`Cleared node client for ${normalizedUrl}`);
  }

  /**
   * Clear all cached clients.
   */
  clearAll(): void {
    this.nodeClients.clear();
    logger.info('Cleared all node clients');
  }
}

export const NetworkService = new NetworkServiceClass();
