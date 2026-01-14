import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Link,
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useUniversalWallet, useModal, MODAL_IDS } from '../hooks';
import {
  isEmbeddedConnector,
  isBrowserWalletConnector,
  isExternalSignerConnector,
  type WalletConnector,
  type ExternalSignerWalletConnector,
} from '../types/walletConnector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/Dialog';
import { Button } from './ui/Button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/Select';
import { Badge } from './ui/Badge';
import { cn, iconSize } from '../utils';

interface ConnectWalletModalProps {
  onWalletConnected?: () => void;
}

const styles = {
  content: 'max-w-md',
  description: 'text-muted text-sm',
  contentWrapper: 'flex flex-col gap-4 mt-4',
  section: 'flex flex-col gap-3',
  sectionLabel: 'text-sm font-semibold text-default',
  dialogTitle: 'flex items-center gap-2',
  iconAccent: 'text-accent',
  networkStatus: {
    base: 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
    notConnected:
      'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    initializing: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
    connected: 'bg-green-500/10 text-green-400 border border-green-500/20',
  },
  actionButton: 'w-full justify-center',
  embeddedActions: 'flex flex-col gap-2',
  badgeWrapper: 'self-start',
  divider: 'border-t border-border my-2',
};

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  onWalletConnected,
}) => {
  const { isOpen, close, onOpenChange } = useModal(MODAL_IDS.CONNECT_WALLET);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const {
    connectors,
    isInitialized,
    isLoading,
    error,
    currentConfig,
    switchToNetwork,
    getNetworkOptions,
  } = useUniversalWallet();

  // Get embedded connector
  const embeddedConnector = connectors.find((conn) =>
    isEmbeddedConnector(conn)
  );

  // Check if embedded connector has a saved account
  const hasSavedEmbeddedAccount =
    embeddedConnector && isEmbeddedConnector(embeddedConnector)
      ? embeddedConnector.hasSavedAccount()
      : false;

  // Get external signer connectors (MetaMask, etc.)
  const externalSignerConnectors = connectors.filter(
    (conn): conn is ExternalSignerWalletConnector =>
      isExternalSignerConnector(conn)
  );

  // Get browser wallet connectors (Azguard, etc.)
  const browserWalletConnectors = connectors.filter((conn) =>
    isBrowserWalletConnector(conn)
  );

  // Disable functionality when no network is selected, network is initializing, or failed
  const isNetworkSelected = currentConfig?.name && currentConfig.name !== '';
  const isNetworkInitializing =
    isNetworkSelected && !isInitialized && isLoading;
  const isNetworkFailed = isNetworkSelected && error && !isInitialized;
  const isActionDisabled =
    !isNetworkSelected ||
    isNetworkInitializing ||
    isNetworkFailed ||
    isConnecting;

  // Check if any connector is already connected
  const hasConnectedWallet = connectors.some((connector) => {
    try {
      return connector.getStatus().status === 'connected';
    } catch {
      return false;
    }
  });

  // Close modal if wallet is already connected when modal opens
  useEffect(() => {
    if (isOpen && hasConnectedWallet && !isConnecting) {
      close();
    }
  }, [isOpen, hasConnectedWallet, isConnecting, close]);

  const isConnectorDisabled = (connector: WalletConnector) => {
    try {
      const status = connector.getStatus();
      return (
        !isNetworkSelected ||
        isNetworkInitializing ||
        isNetworkFailed ||
        isConnecting ||
        status.status === 'connected'
      );
    } catch {
      // Connector not initialized yet
      return true;
    }
  };

  const handleEmbeddedWalletAction = async (action: 'create' | 'existing') => {
    if (isConnecting || !isEmbeddedConnector(embeddedConnector)) return;
    setIsConnecting(true);
    try {
      switch (action) {
        case 'create':
          await embeddedConnector.createAccount();
          break;
        case 'existing': {
          const wallet = await embeddedConnector.connectExistingAccount();
          if (!wallet) {
            console.warn('No stored account found to connect');
            return;
          }
          break;
        }
      }
      onWalletConnected?.();
      close();
    } catch (err) {
      console.error(`Failed to ${action} account:`, err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBrowserWalletConnect = async (connector: WalletConnector) => {
    try {
      const status = connector.getStatus();
      if (isConnecting || status.status === 'connecting') return;
    } catch {
      // Connector not initialized
      return;
    }

    setConnectingId(connector.id);
    try {
      await connector.connect();
      onWalletConnected?.();
      close();
    } catch (err) {
      console.error(`Failed to connect ${connector.label}:`, err);
    } finally {
      setConnectingId(null);
    }
  };

  const handleExternalSignerConnect = async (
    connector: ExternalSignerWalletConnector
  ) => {
    setConnectingId(connector.id);
    try {
      await connector.connect();
      onWalletConnected?.();
      close();
    } catch (err) {
      console.error(`Failed to connect ${connector.label}:`, err);
    } finally {
      setConnectingId(null);
    }
  };

  const handleNetworkChange = (networkName: string) => {
    console.log('🔄 Network change requested from modal:', {
      from: currentConfig.name,
      to: networkName,
    });

    if (networkName && networkName !== currentConfig.name) {
      switchToNetwork(networkName);
    }
  };

  const getConnectorStatus = (connector: WalletConnector) => {
    try {
      return connector.getStatus();
    } catch {
      return {
        isInstalled: false,
        status: 'disconnected' as const,
        error: null,
      };
    }
  };

  const getNetworkStatusStyle = () => {
    if (!isNetworkSelected) return styles.networkStatus.notConnected;
    if (isNetworkInitializing) return styles.networkStatus.initializing;
    if (isNetworkFailed) return styles.networkStatus.failed;
    return styles.networkStatus.connected;
  };

  const networkOptions = getNetworkOptions();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>
            <Wallet size={iconSize('md')} className={styles.iconAccent} />
            Connect Wallet
          </DialogTitle>
          <DialogDescription className={styles.description}>
            Create or connect to an Aztec account using a wallet.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.contentWrapper}>
          {/* Network Section */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Network</label>
            <Select
              value={currentConfig?.name || ''}
              onValueChange={handleNetworkChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select network" />
              </SelectTrigger>
              <SelectContent>
                {networkOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Network Status */}
            <div
              className={cn(styles.networkStatus.base, getNetworkStatusStyle())}
            >
              {!isNetworkSelected && (
                <>
                  <AlertCircle size={iconSize()} />
                  <span>Network not connected</span>
                </>
              )}
              {isNetworkInitializing && (
                <>
                  <Loader2 size={iconSize()} className="animate-spin" />
                  <span>Initializing network connection...</span>
                </>
              )}
              {isNetworkFailed && (
                <>
                  <AlertCircle size={iconSize()} />
                  <span>{currentConfig.displayName} connection failed</span>
                </>
              )}
              {isNetworkSelected && isInitialized && (
                <>
                  <CheckCircle size={iconSize()} />
                  <span>{currentConfig.displayName} connected</span>
                </>
              )}
            </div>
          </div>

          {/* Browser Wallet Section */}
          {browserWalletConnectors.length > 0 && (
            <div className={styles.section}>
              <label className={styles.sectionLabel}>Browser Wallet</label>
              {browserWalletConnectors.map((connector) => {
                const status = getConnectorStatus(connector);
                const isThisConnecting = connectingId === connector.id;
                const isConnected = status.status === 'connected';

                return (
                  <Button
                    key={connector.id}
                    onClick={() => handleBrowserWalletConnect(connector)}
                    disabled={isConnectorDisabled(connector)}
                    variant={isConnected ? 'secondary' : 'primary'}
                    className={styles.actionButton}
                    isLoading={
                      isThisConnecting || status.status === 'connecting'
                    }
                    icon={<Globe size={iconSize()} />}
                  >
                    {isConnected && `${connector.label} Connected`}
                    {!isConnected && `Connect ${connector.label}`}
                  </Button>
                );
              })}
            </div>
          )}

          {/* External Signer Section */}
          {externalSignerConnectors.length > 0 && (
            <div className={styles.section}>
              <label className={styles.sectionLabel}>External Signer</label>
              {externalSignerConnectors.map((connector) => {
                const status = getConnectorStatus(connector);
                const isThisConnecting = connectingId === connector.id;
                const isConnected = status.status === 'connected';

                return (
                  <Button
                    key={connector.id}
                    onClick={() => handleExternalSignerConnect(connector)}
                    disabled={isConnectorDisabled(connector)}
                    variant={isConnected ? 'secondary' : 'primary'}
                    className={styles.actionButton}
                    isLoading={
                      isThisConnecting || status.status === 'connecting'
                    }
                    icon={<Link size={iconSize()} />}
                  >
                    {isConnected && `${connector.label} Connected`}
                    {!isConnected && `Connect ${connector.label}`}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Embedded Wallet Section */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Embedded Wallet</label>
            <div className={styles.embeddedActions}>
              <Button
                onClick={() => handleEmbeddedWalletAction('existing')}
                disabled={isActionDisabled || !hasSavedEmbeddedAccount}
                variant="secondary"
                className={styles.actionButton}
                isLoading={isConnecting}
                icon={<Link size={iconSize()} />}
              >
                Connect Existing Account
              </Button>
              {!hasSavedEmbeddedAccount && (
                <Badge variant="warning" className={styles.badgeWrapper}>
                  No saved account found
                </Badge>
              )}
              <Button
                onClick={() => handleEmbeddedWalletAction('create')}
                disabled={isActionDisabled}
                variant="primary"
                className={styles.actionButton}
                isLoading={isConnecting}
                icon={<Plus size={iconSize()} />}
              >
                Create New Account
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
