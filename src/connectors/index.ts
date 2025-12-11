// Connectors
export {
  EmbeddedConnector,
  EMBEDDED_CONNECTOR_ID,
  createEmbeddedConnector,
} from './EmbeddedConnector';

export {
  ExternalSignerConnector,
  EXTERNAL_SIGNER_CONNECTOR_ID,
} from './ExternalSignerConnector';

export {
  BrowserWalletConnector,
  BROWSER_WALLET_CONNECTOR_ID,
  AZGUARD_CONNECTOR_ID,
  createAzguardConnector,
} from './BrowserWalletConnector';

// Registry and factories
export { createConnectorRegistry } from './registry';
export type { ConnectorFactory, ConnectorRegistryOptions } from './registry';
export { embedded, azguard, evmWallet, browserWallet } from './factories';

// Legacy connectors (for backwards compatibility during transition)
export { AzguardConnector } from './AzguardConnector';
