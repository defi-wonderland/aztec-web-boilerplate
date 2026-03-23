import React, { useCallback, useMemo } from 'react';
import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '../../../components/ui';
import { cn, iconSize } from '../../../utils';
import {
  getNetworkIcon,
  getNetworkDisplayName,
} from '../../config/networkPresets';
import { useNetworkStore } from '../../store/network';
import { NetworkIcon } from '../shared';
import type { AztecNetwork } from '../../../config/networks/constants';
import type { NetworkPreset } from '../../types';

const styles = {
  content: 'sm:max-w-sm',
  header: 'mb-2',
  title: 'text-lg font-semibold text-default',
  subtitle: 'text-sm text-muted mt-2 mb-4',
  list: 'flex flex-col gap-2 stagger-children',
  networkButton: [
    'group w-full flex items-center gap-3',
    'px-4 py-3 rounded-xl',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-transparent hover:border-accent/30',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  networkButtonActive: 'border-accent/50 bg-accent/5 hover:bg-accent/10',
  iconContainer: [
    'flex items-center justify-center',
    'w-10 h-10 rounded-xl',
    'bg-surface-tertiary',
  ].join(' '),
  networkIcon: 'text-accent text-lg',
  networkName: 'text-sm font-medium text-default',
  spacer: 'flex-1',
  checkIcon: 'text-green-500',
} as const;

export interface NetworkModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onOpenChange: (open: boolean) => void;
  /** Available networks */
  networks: NetworkPreset[];
  /** Optional title */
  title?: string;
}

/**
 * Network button component for the modal
 */
interface NetworkButtonProps {
  network: NetworkPreset;
  isActive: boolean;
  onClick: () => void;
}

const NetworkButton: React.FC<NetworkButtonProps> = ({
  network,
  isActive,
  onClick,
}) => {
  const icon = getNetworkIcon(network.name, network.icon);
  const displayName = getNetworkDisplayName(network.name, network.displayName);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        styles.networkButton,
        isActive && styles.networkButtonActive
      )}
      data-testid={`network-option-${network.name}`}
    >
      <div className={styles.iconContainer}>
        <NetworkIcon icon={icon} size="md" className={styles.networkIcon} />
      </div>
      <span className={styles.networkName}>{displayName}</span>
      <span className={styles.spacer} />
      {isActive && <Check size={iconSize()} className={styles.checkIcon} />}
    </button>
  );
};

/**
 * Network selection modal
 *
 * Shows available networks and allows switching between them.
 */
export const NetworkModal: React.FC<NetworkModalProps> = ({
  open,
  onOpenChange,
  networks,
  title = 'Switch Network',
}) => {
  const currentConfig = useNetworkStore((state) => state.currentConfig);
  const switchToNetwork = useNetworkStore((state) => state.switchToNetwork);

  const handleNetworkSelect = useCallback(
    (networkName: AztecNetwork) => {
      switchToNetwork(networkName);
      onOpenChange(false);
    },
    [switchToNetwork, onOpenChange]
  );

  const networkList = useMemo(() => {
    return networks.map((network) => ({
      ...network,
      isActive: network.name === currentConfig.name,
    }));
  }, [networks, currentConfig.name]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={styles.content}
        aria-describedby={undefined}
        data-testid="network-modal"
      >
        <div className={styles.header}>
          <DialogTitle className={styles.title}>{title}</DialogTitle>
        </div>

        <p className={styles.subtitle}>
          Aztec supports multiple networks for different use cases. Select the
          one that best fits your needs.
        </p>

        <div className={styles.list}>
          {networkList.map((network) => (
            <NetworkButton
              key={network.name}
              network={network}
              isActive={network.isActive}
              onClick={() => handleNetworkSelect(network.name)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
