import React from 'react';
import { useAztecWallet, isEmbeddedConnector } from '../aztec-wallet';
import { SecurityWarning } from '../components';
import { useAppNavigation } from '../hooks';
import { ContractInteractionCard } from './ContractInteractionCard';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { UIComponentsShowcase } from './UIComponentsShowcase';

const styles = {
  main: 'flex flex-col',
  contentWrapper:
    'w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6',
  settingsWrapper: 'w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6',
} as const;

export const MainContent: React.FC = () => {
  const { connector } = useAztecWallet();
  const { activeTab } = useAppNavigation();

  const showSecurityWarning =
    connector?.getStatus().status === 'connected' &&
    isEmbeddedConnector(connector);

  const renderContent = () => {
    switch (activeTab) {
      case 'mint':
        return (
          <div className={styles.contentWrapper}>
            {showSecurityWarning && <SecurityWarning />}
            <DripperCard />
          </div>
        );
      case 'contract':
        return (
          <div className={styles.contentWrapper}>
            {showSecurityWarning && <SecurityWarning />}
            <ContractInteractionCard />
          </div>
        );
      case 'settings':
        return (
          <div className={styles.settingsWrapper}>
            <SettingsCard />
          </div>
        );
      case 'components':
        return (
          <div className={styles.contentWrapper}>
            <UIComponentsShowcase />
          </div>
        );
      default:
        return null;
    }
  };

  return <main className={styles.main}>{renderContent()}</main>;
};
