import React from 'react';
import { useAztecWallet } from '@aztec-wallet';
import { Header, NetworkError } from './components';
import { Layout } from './containers/Layout';
import { FEATURE_BY_ID, FEATURES } from './features';
import { useAppNavigation } from './hooks';
import { AppNavigationProvider, AppProvider } from './providers';
import { cn } from './utils';

const styles = {
  container: 'min-h-screen',
  bgSettings: 'bg-page',
  bgDefault: 'bg-surface',
  main: 'flex flex-col',
  errorContainer: 'w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6',
} as const;

const AppContent: React.FC = () => {
  const { networkStatus, networkError, networkName, checkNetwork } =
    useAztecWallet();
  const { activeTab } = useAppNavigation();
  const fallbackFeature = FEATURES[0] ?? null;
  const selectedFeature =
    (activeTab ? FEATURE_BY_ID.get(activeTab) : null) ?? fallbackFeature;

  const showNetworkError = networkStatus === 'error';

  return (
    <div
      className={cn(
        styles.container,
        selectedFeature?.pageVariant === 'page'
          ? styles.bgSettings
          : styles.bgDefault
      )}
    >
      <Header />

      {showNetworkError && (
        <div className={styles.errorContainer}>
          <NetworkError
            error={networkError}
            networkName={networkName}
            onRetry={checkNetwork}
          />
        </div>
      )}

      <main className={styles.main}>
        <Layout />
      </main>
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <AppNavigationProvider>
        <AppContent />
      </AppNavigationProvider>
    </AppProvider>
  );
}
